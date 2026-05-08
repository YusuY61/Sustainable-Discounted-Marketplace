import "dotenv/config";
import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import db from "./db.js";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import { body, validationResult } from 'express-validator';


const app = express();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) ?? "";
    const name = path.basename(file.originalname, ext);
    cb(null, `${Date.now()}-${name}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [".jpg", ".jpeg", ".png", ".gif"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(null, false);
    req.fileRejected = true;
  }
};

const upload = multer({ storage, fileFilter });

//burayı kontrol etmemiz lazım
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationMail(email, code) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("Email info is missing. Verification code:", code);
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Discount Marketplace Verification Code",
      text: `Your verification code is: ${code}`,
    });
  } catch (error) {
    console.log("Mail could not be sent:", error.message);
    console.log("Verification code:", code);
  }
}

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }),
);

// kullanıcı burdan girecek ve eğer hesabı giriliyse urlden buraya tekrar gelemeyecek
// dashboardına re-direcet yaptırıyoruz
app.get("/", async (req, res) => {
    if (req.session.user) {
    if (req.session.user.role === "market") {
      return res.redirect("/market/dashboard");
    }

    if (req.session.user.role === "consumer") {
      return res.redirect("/consumer/dashboard");
    }
  }
  res.render("main/index", { error: null });
});
// log-out direkt ana sayfaya atıyoruz ve sessionu da siliyorum
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});


app.get("/register-market", (req, res) => {
  res.render("market/register-market", { error: null, old: {} });
});

app.post("/register-market", 
  body("email").isEmail().withMessage("Please enter a valid email!"),
  body("password").isLength({min: 8}).withMessage("Password must be at least 8 characters!"),
  body("city").not().matches(/\d/).withMessage("City cannot contain numbers."),
  body("district").not().matches(/\d/).withMessage("District cannot contain numbers."),
  async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render("market/register-market", {
      error: errors.array()[0].msg,
      old: req.body,
    });
  }

  const { email, marketName, password, city, district } = req.body;

  const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
    email,
  ]);

  if (existing.length > 0) {
    return res.render("market/register-market", {
      error: "This email is already registered.",
      old: req.body,
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const verificationCode = Math.floor(
    100000 + Math.random() * 900000,
  ).toString();

  await db.query(
    "INSERT INTO users (email, password, market_name, city, district, role, verification_code, is_verified) VALUES (?, ?, ?, ?, ?, 'market', ?, false)",
    [email, hashedPassword, marketName, city, district, verificationCode],
  );

  console.log("Market verification code:", verificationCode);
  await sendVerificationMail(email, verificationCode);

  res.render("verify", {
    email,
    code: "",
    message: "Registration completed. Verification code was sent to your email.",
    error: null,
  });
});

app.get("/register-consumer", (req, res) => {
  res.render("consumer/register-consumer", { error: null, old: {} });
});

app.get("/profile", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const [rows] = await db.query(
    "SELECT id, email, role, market_name, full_name, city, district FROM users WHERE id = ?",
    [req.session.user.id],
  );

  if (rows.length === 0) {
    return res.redirect("/");
  }

  res.render("profile", {
    user: rows[0],
    error: null,
    success: null,
  });
});

app.post("/profile-update", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const { email, name, city, district, currentPassword, newPassword } = req.body;
  const userId = req.session.user.id;
  const role = req.session.user.role;

  // Beyler burada mevcut veriyi çekiyoruz
  const [rows] = await db.query(
    "SELECT id, email, password, role, market_name, full_name, city, district FROM users WHERE id = ?",
    [userId],
  );

  if (rows.length === 0) {
    return res.redirect("/");
  }

  const user = rows[0];

  // Alanların boş olup olmadığını check ettim
  if (!email || !name || !city || !district) {
    return res.render("profile", {
      user,
      error: "Please fill all fields.",
      success: null,
    });
  }

  // Email başkasında mı?
  if (email !== user.email) {
    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id <> ?",
      [email, userId],
    );
    if (existing.length > 0) {
      return res.render("profile", {
        user,
        error: "This email is already registered by another account.",
        success: null,
      });
    }
  }

  // Şifre değişimi istenmişse mevcut şifreyi doğrula
  let hashedPassword = user.password;
  if (newPassword && newPassword.trim() !== "") {
    if (!currentPassword) {
      return res.render("profile", {
        user,
        error: "Please enter your current password to change it.",
        success: null,
      });
    }
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.render("profile", {
        user,
        error: "Current password is wrong.",
        success: null,
      });
    }
    hashedPassword = await bcrypt.hash(newPassword, 10);
  }

  // Role'e göre doğru name kolonunu güncelle
  if (role === "market") {
    await db.query(
      "UPDATE users SET email = ?, market_name = ?, city = ?, district = ?, password = ? WHERE id = ?",
      [email, name, city, district, hashedPassword, userId],
    );
  } else {
    await db.query(
      "UPDATE users SET email = ?, full_name = ?, city = ?, district = ?, password = ? WHERE id = ?",
      [email, name, city, district, hashedPassword, userId],
    );
  }

  // Session'daki email'i de güncelle
  req.session.user.email = email;

  // Güncel veriyi tekrar çekip göster
  const [updated] = await db.query(
    "SELECT id, email, role, market_name, full_name, city, district FROM users WHERE id = ?",
    [userId],
  );

  res.render("profile", {
    user: updated[0],
    error: null,
    success: "Profile updated successfully.",
  });
});

app.post("/register-consumer", async (req, res) => {
  const { email, fullName, password, city, district } = req.body;

  // Validation
  if (!email || !fullName || !password || !city || !district) {
    return res.render("register-consumer", {
      error: "Please fill all fields.",
      old: req.body,
    });
  }

  // Email daha önce alınmış mı?
  const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
    email,
  ]);
  if (existing.length > 0) {
    return res.render("register-consumer", {
      error: "This email is already registered.",
      old: req.body,
    });
  }

  // Şifreyi hashle
  const hashedPassword = await bcrypt.hash(password, 10);

  // Verification code üret
  const verificationCode = Math.floor(
    100000 + Math.random() * 900000,
  ).toString();

  // DB'ye kaydet (is_verified = false)
  await db.query(
    "INSERT INTO users (email, password, full_name, city, district, role, verification_code, is_verified) VALUES (?, ?, ?, ?, ?, 'consumer', ?, false)",
    [email, hashedPassword, fullName, city, district, verificationCode],
  );

  console.log("Consumer verification code:", verificationCode);
  await sendVerificationMail(email, verificationCode);

  res.render("verify", {
    email,
    code: "",
    message: "Registration completed. Verification code was sent to your email.",
    error: null,
  });
});

app.post("/verify", (req, res) => {
  const { email, code } = req.body;
  
  res.render("main/index", {
    success: "Email verified successfully. You can login now.",
    error: null
  });
});

app.get("/verify", (req, res) => {
  res.render("verify", {
    email: "",
    code: "",
    message: null,
    error: null,
  });
});
// loginde eğer kullanıcı zaten login yaptıysa tekrar login sayfasına getirtmiyoruz
app.post("/login", async (req, res) => {
    if (req.session.user) {
    if (req.session.user.role === "market") {
      return res.redirect("/market/dashboard");
    }

    if (req.session.user.role === "consumer") {
      return res.redirect("/consumer/dashboard");
    }
  }
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render("main/index", {
      error: "Please enter email and password.",
    });
  }
  const [rows] = await db.query(
    "SELECT id, email, password, role FROM users WHERE email = ?",
    [email],
  );
  if (rows.length === 0) {
    return res.render("main/index", {
      error: "Email or password is wrong.",
    });
  }
  const user = rows[0];
  const checkPassword = await bcrypt.compare(password, user.password);

  if (!checkPassword) {
    return res.render("main/index", {
      error: "Email or password is wrong.",
    });
  }

  req.session.user = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  if (user.role === "market") {
    return res.redirect("/market/dashboard");
  }

  res.redirect("/consumer/dashboard");
});

function checkMarket(req, res, next) {
  if (!req.session.user || req.session.user.role !== "market") {
    return res.redirect("/");
  }
  next();
}

function checkConsumer(req, res, next) {
  if (!req.session.user || req.session.user.role !== "consumer") {
    return res.redirect("/");
  }
  next();
}

app.get("/market/dashboard", checkMarket, async (req, res) => {
  const [arr] = await db.query(
    `SELECT * FROM products WHERE market_id = ?`,
    [req.session.user.id],
  );

  let message = null;
  if (req.query.deleted !== undefined) {
    const count = parseInt(req.query.deleted);
    if (count > 0) {
      message = `${count} expired product(s) deleted successfully.`;
    } else {
      message = "No expired products to delete.";
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  arr.forEach(product => {
    const expDate = new Date(product.expiration_date);
    const diffMs = expDate - today;
    product.remaining_days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  });

  res.render("market/dashboard-market", { arr, errors: [], message, oldForm: {} });
});

app.post("/market/dashboard", checkMarket, upload.single("image"), async (req, res) => {
  console.log(req.body);
  console.log(req.session);
  const imagePath = req.file ? req.file.filename : null;
  let { name, stock, normalPrice, discountedPrice, expirationDate } = req.body;
  const errors = [];
  name = name.trim();
  stock = parseInt(stock)
  normalPrice = parseInt(normalPrice)
  discountedPrice = parseInt(discountedPrice)

  if (!name) {
    errors.push("Product must have a title.")
  }
  if (!stock || stock <= 0) {
    errors.push("Stock must be a positive integer.")
  }
  if (!normalPrice || normalPrice <= 0) {
    errors.push("Normal price must be a positive integer.")
  }
  if (!discountedPrice || discountedPrice <= 0) {
    errors.push("Normal price must be a positive integer.")
  }
  if (normalPrice <= discountedPrice) {
    errors.push("Discounted price must be less than normal price.")
  }
  if (!expirationDate) {
    errors.push("Product must have an expiration date.")
  }

  if (errors.length > 0) {
    const [arr] = await db.query(`SELECT * FROM products WHERE market_id = ?`, [req.session.user.id])
    return res.render("market/dashboard-market", { arr, errors, oldForm: req.body })
  }
  try {
    await db.query(
      `INSERT into products (market_id, title, stock, normal_price, discounted_price, expiration_date, image_path) values (?, ?, ?, ?, ?, ?, ?) `,
      [
        req.session.user.id,
        name,
        stock,
        normalPrice,
        discountedPrice,
        expirationDate,
        imagePath,
      ],
    );
    res.redirect("/market/dashboard");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Add error");
    // res.redirect("/market/dashboard");
  }

});

app.get("/market/edit-product/:id", checkMarket, async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM products WHERE id = ? AND market_id = ?",
    [req.params.id, req.session.user.id],
  );
  if (rows.length === 0) {
    return res.redirect("/market/dashboard");
  }
  res.render("edit-product", { product: rows[0] });
});

app.post("/market/edit-product/:id", checkMarket, upload.single("image"), async (req, res) => {
  try {
    if (req.file) {
      // yeni image yüklendi
      await db.query(
        `UPDATE products SET title = ?, stock = ?, normal_price = ?, discounted_price = ?, expiration_date = ?, image_path = ? WHERE id = ? AND market_id = ?`,
        [
          req.body.name.trim(),
          req.body.stock,
          req.body.normalPrice,
          req.body.discountedPrice,
          req.body.expirationDate,
          req.file.filename,
          req.params.id,
          req.session.user.id,
        ],
      );
    } else {
      // image yüklenmedi, eskisini koru
      await db.query(
        `UPDATE products SET title = ?, stock = ?, normal_price = ?, discounted_price = ?, expiration_date = ? WHERE id = ? AND market_id = ?`,
        [
          req.body.name.trim(),
          req.body.stock,
          req.body.normalPrice,
          req.body.discountedPrice,
          req.body.expirationDate,
          req.params.id,
          req.session.user.id,
        ],
      );
    }
    res.redirect("/market/dashboard");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Edit error");
  }
});

app.get("/market/delete-product/:id", checkMarket, async (req, res) => {
  try {
    await db.query(
      "DELETE FROM products WHERE id = ? AND market_id = ?",
      [req.params.id, req.session.user.id],
    );
    res.redirect("/market/dashboard");
  } catch (error) {
    res.status(500).send("Delete error");
  }
});

app.post("/market/delete-expired", checkMarket, async (req, res) => {
  try {
    const [result] = await db.query(
      "DELETE FROM products WHERE market_id = ? AND expiration_date < CURDATE()",
      [req.session.user.id],
    );
    res.redirect(`/market/dashboard?deleted=${result.affectedRows}`);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Delete expired error");
  }
});

// incele
app.get("/consumer/dashboard", checkConsumer, async (req, res) => {
  let index = Number(req.query.page ?? 0)
  const search = req.query.search ?? "";
  let products = []

  //isim için ekledim
  const [consumer] = await db.query("SELECT * FROM users WHERE id = ?", [
    req.session.user.id,
  ]);
  const userName = consumer[0].full_name;
  const city = consumer[0].city;
  const district = consumer[0].district;

  if (req.query.pageNumber) {
    let pageNumber = Number(req.query.pageNumber)
    index = (pageNumber - 1) * 4
    const [arr] = await db.query(
      `SELECT products.*, users.market_name, users.district,
      DATEDIFF(products.expiration_date, CURDATE()) AS remaining_days
      FROM products, users
      WHERE products.market_id = users.id
      AND products.title LIKE ?
      AND users.city = ?
      AND products.expiration_date >= CURDATE()
      ORDER BY users.district = ? DESC
      LIMIT ${index}, 4`,
      [`%${search}%`, city, district],
    );
    const [[countRow]] = await db.query("select count(*) as total from products,users where products.market_id = users.id AND products.title LIKE ? AND users.city = ? AND products.expiration_date >= CURDATE()", [`%${search}%`, city])
    const total = countRow.total

    let page_count = Math.ceil(total / 4)

    products = arr;

    res.render("consumer/dashboard-consumer", {
      search: search,
      products: products,
      index,
      maxSize: total,
      page_count,
      current_page: pageNumber,
      userName: userName,
    });
  }
  else if (search !== "") {
    const [arr] = await db.query(
      `SELECT products.*, users.market_name, users.district,
      DATEDIFF(products.expiration_date, CURDATE()) AS remaining_days
      FROM products, users
      WHERE products.market_id = users.id
      AND products.title LIKE ?
      AND users.city = ?
      AND products.expiration_date >= CURDATE()
      ORDER BY users.district = ? DESC
      LIMIT ${index}, 4`,
      [`%${search}%`, city, district],
    );
    const [[countRow]] = await db.query("select count(*) as total from products,users where products.market_id = users.id AND products.title LIKE ? AND users.city = ? AND products.expiration_date >= CURDATE()", [`%${search}%`, city])
    const total = countRow.total

    let page_count = Math.ceil(total / 4)
    let current_page = index / 4 + 1

    products = arr;

    res.render("consumer/dashboard-consumer", {
      search: search,
      products: products,
      index,
      maxSize: total,
      page_count,
      current_page,
      userName: userName,
    });
  }
  else {
    res.render("consumer/dashboard-consumer", {
      search: search,
      products,
      userName: userName,
    });
  }
});

app.post("/cart/add", checkConsumer, async (req, res) => {
  const {productId} = req.body
  const consumerId = req.session.user.id

  const [existing] = await db.query(
    "SELECT id FROM cart_items WHERE consumer_id = ? AND product_id = ?",
    [consumerId, productId]
  )

  if (existing.length > 0) {
    await db.query(
      "UPDATE cart_items SET quantity = quantity + 1 WHERE consumer_id = ? AND product_id = ?",
      [consumerId, productId]
    );
  } else {
    await db.query(
      "INSERT INTO cart_items (consumer_id, product_id, quantity) VALUES (?, ?, 1)",
      [consumerId, productId]
    );
  }

  res.json({ success: true });
})

app.post("/cart/remove", checkConsumer, async (req, res) => {
  const {productId} = req.body
  const consumerId = req.session.user.id

  const [items] = await db.query(
    "SELECT id, quantity FROM cart_items WHERE consumer_id = ? AND product_id = ?",
    [consumerId, productId]
  )

  if (items.length === 0) {
    return res.json({ success: false })
  }

  const item = items[0]

  if (item.quantity > 1) {
    await db.query(
      "UPDATE cart_items SET quantity = quantity - 1 WHERE consumer_id = ? AND product_id = ?",
      [consumerId, productId]
    );
  } else {
    await db.query(
      "DELETE FROM cart_items WHERE consumer_id = ? AND product_id = ?",
      [consumerId, productId]
    );
  }

  res.json({ success: true })
})

app.get("/cart", checkConsumer, async (req, res) => {
//   const consumerId = req.session.user.id

//   const [products] = await db.query(
//   `SELECT cart_items.product_id, cart_items.quantity, products.title, products.discounted_price, products.image_path 
//    FROM cart_items 
//    JOIN products ON cart_items.product_id = products.id 
//    WHERE cart_items.consumer_id = ?`,
//   [consumerId]
// );

  res.render("cart", {products: []});
});

app.get("/cart/items", checkConsumer, async (req, res) => {
    const consumerId = req.session.user.id

  const [products] = await db.query(
    `SELECT cart_items.product_id, cart_items.quantity, products.title, products.discounted_price as price, products.image_path 
    FROM cart_items 
    JOIN products ON cart_items.product_id = products.id 
    WHERE cart_items.consumer_id = ?`,
    [consumerId]
  );

  res.json(products);
})

app.listen(process.env.PORT, () => {
  console.log(`Running on port ${process.env.PORT}`);
});
