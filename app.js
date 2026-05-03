import "dotenv/config";
import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import db from "./db.js";

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.get("/", async (req, res) => {
    res.render("index", { error: null });
});

app.get("/register-market", (req, res) => {
    res.render("register-market", { error: null, old: {} });
});
app.post("/register-market", (req, res) => {
    const { email, marketName, password, city, district } = req.body;
    if (!email || !marketName || !password || !city || !district) {
        return res.render("register-market", {
            error: "Please fill all fields.",
            old: req.body
        });
    }
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Market verification code:", verificationCode);
    res.render("verify", {
        email: email,
        code: verificationCode,
        message: "Registration completed. Please enter the verification code.",
        error: null
    });
});

app.get("/register-consumer", (req, res) => {
    res.render("register-consumer", { error: null, old: {} });
});
// app.post("/register-consumer", (req, res) => {
//     const { email, fullName, password, city, district } = req.body;
//     if (!email || !fullName || !password || !city || !district) {
//         return res.render("register-consumer", {
//             error: "Please fill all fields.",
//             old: req.body
//         });
//     }
//     const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
//     console.log("Consumer verification code:", verificationCode);
//     res.render("verify", {
//         email: email,
//         code: verificationCode,
//         message: "Registration completed. Please enter the verification code.",
//         error: null
//     });
// });

app.post("/register-consumer", async (req, res) => {
    const { email, fullName, password, city, district } = req.body;

    // Validation
    if (!email || !fullName || !password || !city || !district) {
        return res.render("register-consumer", {
            error: "Please fill all fields.",
            old: req.body
        });
    }

    // Email daha önce alınmış mı?
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
        return res.render("register-consumer", {
            error: "This email is already registered.",
            old: req.body
        });
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 10);

    // Verification code üret
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // DB'ye kaydet (is_verified = false)
    await db.query(
        "INSERT INTO users (email, password, full_name, city, district, role, verification_code, is_verified) VALUES (?, ?, ?, ?, ?, 'consumer', ?, false)",
        [email, hashedPassword, fullName, city, district, verificationCode]
    );

    console.log("Consumer verification code:", verificationCode);

    res.render("verify", {
        email,
        code: verificationCode,
        message: "Registration completed. Please enter the verification code.",
        error: null
    });
});

app.post("/verify", (req, res) => {
    const { email, code } = req.body;

    res.render("index", {
        error: "Email verified successfully. You can login now."
    });
});

app.get("/verify", (req, res) => {
    res.render("verify", {
        email: "",
        code: "",
        message: null,
        error: null
    });
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render("index", {
            error: "Please enter email and password."
        });
    }

    res.redirect("/market/dashboard");
});

app.get("/market/dashboard", (req, res) => {
    res.render("dashboard-market");
});

app.get("/consumer/dashboard", (req, res) => {
    res.render("dashboard-consumer");
});

app.listen(process.env.PORT, () => {
    console.log(`Running on port ${process.env.PORT}`);
});