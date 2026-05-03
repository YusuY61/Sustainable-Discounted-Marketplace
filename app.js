import express from "express";
import session from "express-session";
import db from "./db.js";
import "dotenv/config";

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
app.post("/register-consumer", (req, res) => {
    const { email, fullName, password, city, district } = req.body;
    if (!email || !fullName || !password || !city || !district) {
        return res.render("register-consumer", {
            error: "Please fill all fields.",
            old: req.body
        });
    }
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Consumer verification code:", verificationCode);
    res.render("verify", {
        email: email,
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