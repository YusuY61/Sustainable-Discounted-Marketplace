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
    res.render("index");
});

app.listen(process.env.PORT, () => {
    console.log(`Running on port ${process.env.PORT}`);
});