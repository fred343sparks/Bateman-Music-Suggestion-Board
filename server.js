require("dotenv").config();
const sanitizeHTML = require('sanitize-html')
const marked = require("marked")
const jwt =  require("jsonwebtoken");
const bycrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const express = require("express");
const { stat } = require("fs");
const mysql = require("mysql2")

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'fappah',
    database: 'batemanboard'
}).promise();

//database setup
/* SQLITE CODE TO CREATE TABLES BEING REPLACED WITH MYSQL
const createTables = db.transaction(() => {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username STRING NOT NULL UNIQUE,
            password STRING NOT NULL
        )
        `).run()
    
    db.prepare(`
        CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        createdDate TEXT,
        title STRING NOT NULL,
        genere STRING NOT NULL,
        creator STRING NOT NULL,
        video STRING NOT NULL,
        body TEXT,
        authorid INTEGER,
        FOREIGN KEY (authorid) REFERENCES users (id)
        )
        `).run()
})

createTables();
*/

//Datasbase setup end

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(cookieParser());

app.use(function(req, res, next){
    //Make our markdown function available
    res.locals.filterUserHTML = function(content){
        return sanitizeHTML(marked.parse(content),{
            allowedTages: ["p","br", "ul", "ol", "strong", "bold", "i", "em", "h1", "h2", "h3", "h4", "h5"],
            allowedAttributes: {}
        }) // Only allows certain types of content
    }
    
    res.locals.errors = []

    //Try to decode incoming cookie
    try{
        const decoded = jwt.verify(req.cookies.ourSimpleApp, process.env.JWTSECRET);
        req.user = decoded;
    } catch(err) {
        req.user = false;
    }

    res.locals.user = req.user;
    console.log(req.user)

    next()
});

app.get("/", (req, res) => {
    /*if(req.user){
        const postsStatment= db.prepare("SELECT * FROM posts WHERE authorid = ? ORDER BY createdDate DESC")
        const posts = postsStatment.all(req.user.userid)
        return res.render("dashboard", { posts })
    }*/
    res.render("homepage");
})

app.get("/suggestions",  async (req, res) => {
    const [posts] = await pool.query("SELECT * FROM posts ORDER BY createdDate DESC");
    console.log(posts);
    return res.render("suggestions", { posts });
})


app.get("/dashboard",  async (req, res) => {
    if(req.user){
        const [posts] = await pool.query("SELECT * FROM posts WHERE authorid = ? ORDER BY createdDate DESC", [req.user.userid]);
        return res.render("dashboard", { posts });
    }
    return res.redirect("/login");
})

app.get("/logout", (req, res) => {
    res.clearCookie("ourSimpleApp");
    res.redirect("/");
})

app.get("/signup", (req, res) => {
    res.render("signup");
})

app.get("/login", (req, res) => {
    res.render("login");
})

app.post("/login", async (req, res) => {
    let errors = [];

    if(typeof req.body.username !== "string") req.body.username.length = ""
    if(typeof req.body.password !== "string") req.body.password.length = ""

    if(req.body.username.trim().length == "") errors = ["Invalid username or password"];
    if(req.body.password == "") errors = ["Invalid username or password"];

    if(errors.length){
        return  res.render("login", {errors});
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [req.body.username]);
    const userInQuestion = rows[0];

    if(!userInQuestion) {
        errors = ["Invalid username or password"];
        return res.render("login", {errors});
    }

    const passwordMatches = bycrypt.compareSync(req.body.password, userInQuestion.password);
    if(!passwordMatches){
        errors = ["Invalid username or password"];
        return res.render("login", {errors});
    }
    
    //Log the user in by giving them a cookie
    const ourTokenValue = jwt.sign({exp: Math.floor(Date.now()/1000) + 60 * 60  * 24, skyColor: "blue", userid: userInQuestion.id, username: userInQuestion.username},process.env.JWTSECRET);
    
    res.cookie("ourSimpleApp", ourTokenValue, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 //1 day
    })
    
    //Redirect to dashboard after login
    res.redirect("/dashboard")
})

function mustBeLoggedIn(req, res, next){
    if(req.user){
        return next();
    }
    return res.redirect("/");
}

app.get("/create-post", mustBeLoggedIn, (req, res) => {
    res.render("create-post");
})

function sharedPostValidation(req) {
    const errors = []

    if (typeof req.body.title !== "string") req.body.title = ""
    if (typeof req.body.body !== "string") req.body.body = ""

    //trim - sanitize or strip out html

    req.body.title = sanitizeHTML(req.body.title.trim(), {allowedTags: [], allowedAttributes: {}})
    req.body.body = sanitizeHTML(req.body.body.trim(), {allowedTags: [], allowedAttributes: {}})

    if(!req.body.title) errors.push("You must provide a title")
    if(!req.body.body) errors.push("You must provide a content")

    return errors;
}

app.get("/edit-post/:id", mustBeLoggedIn, async (req, res) => {
    //Try to look up the post in question
    const [rows] = await pool.query("SELECT * FROM posts WHERE id = ?", [req.params.id]);
    const post = rows[0];

    if(!post){
            return res.redirect("/")
        }

    // If you are not the author, redirect to homepage
    if (post.authorid !== req.user.userid) {
        return res.redirect("/")
    }

    // otherwise, render the edit post template
    res.render("edit-post", { post })
})

app.post("/edit-post/:id", mustBeLoggedIn, async (req,res) => {
    const [rows] = await pool.query("SELECT * FROM posts WHERE id = ?", [req.params.id]);
    const post = rows[0];

    if(!post){
            return res.redirect("/")
        }

    // If you are not the author, redirect to homepage
    if (post.authorid !== req.user.userid) {
        return res.redirect("/")
    }

    const errors = sharedPostValidation(req)

    if (errors.length){
        return res.render("edit-post", {errors} )
    }

    await pool.query("UPDATE posts SET title = ?, body = ? WHERE id = ?", [req.body.title, req.body.body, req.params.id]);

    res.redirect(`/post/${req.params.id}`)

})

app.post("/delete-post/:id", mustBeLoggedIn, async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM posts WHERE id = ?", [req.params.id]);
    const post = rows[0];

    if(!post){
            return res.redirect("/")
        }

    // If you are not the author, redirect to homepage
    if (post.authorid !== req.user.userid) {
        return res.redirect("/")
    }

    await pool.query("DELETE FROM posts WHERE id = ?", [req.params.id]);

    res.redirect("/")
})

app.get("/post/:id", async (req, res) => {
    const [rows] = await pool.query("SELECT posts.*, users.username FROM posts INNER JOIN users ON posts.authorid = users.id WHERE posts.id = ?", [req.params.id]);
    const post = rows[0];
    
    //Checks if viewer is the author of the post
    const isAuthor = post.authorid === req.user.userid

    if(!post){
            return res.redirect("/")
    }

    res.render("single-post", { post, isAuthor })
})

app.post("/create-post", mustBeLoggedIn, async (req, res) => {
    const errors = sharedPostValidation(req)

    if(errors.length){
        return res.render("create-post", {errors})
    }

    // Save into database
    const [result] = await pool.query(
        "INSERT INTO posts (title, genere, creator, video, body, authorid, createdDate) VALUES (?,?,?,?,?,?,?)",
        [req.body.title, req.body.genere, req.body.creator, req.body.video, req.body.body, req.user.userid, new Date().toISOString()]
    );

    const [rows] = await pool.query("SELECT * FROM posts WHERE id = ?", [result.insertId]);
    const realPost = rows[0];

    res.redirect(`/post/${realPost.id}`);
})

app.post("/register", async (req, res) => {
    // Registration logic here
    const errors = [];

    if(typeof req.body.username !== "string") req.body.username.length = ""
    if(typeof req.body.password !== "string") req.body.password.length = ""

    req.body.username=req.body.username.trim();

    if(!req.body.username.length)errors.push("Username is required");
    if(req.body.username && req.body.username.length < 3)errors.push("Username must be at least 3 characters");
    if(req.body.username && req.body.username.length > 10)errors.push("Username cannot exceed 10 characters");
    if(req.body.username && !req.body.username.match(/^[a-zA-Z0-9]+$/)) errors.push("Username contains invalid characters");

    //Check if username exists already
    const [usernameRows] = await pool.query("SELECT * FROM users WHERE username = ?", [req.body.username]);
    const usernameCheck = usernameRows[0];

    if (usernameCheck){
        errors.push("Username is already taken");
    }

    if(!req.body.password.length)errors.push("password is required");
    if(req.body.password && req.body.password.length < 8)errors.push("Password must be at least 8 characters");
    if(req.body.password && req.body.password.length > 70)errors.push("Password cannot exceed 70 characters");

    if(errors.length){
        return res.render("homepage", {errors})
    }

    //Save the new user into a databse
    const salt = bycrypt.genSaltSync(10);
    req.body.password = bycrypt.hashSync(req.body.password, salt);

    const [result] = await pool.query("INSERT INTO users (username, password) VALUES (?, ?)", [req.body.username, req.body.password]);
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
    const ourUser = rows[0];
    //Log the user in by giving them a cookie
    const ourTokenValue = jwt.sign({exp: Math.floor(Date.now()/1000) + 60 * 60  * 24, skyColor: "blue", userid: ourUser.id, username: ourUser.username},process.env.JWTSECRET)

    res.cookie("ourSimpleApp", ourTokenValue, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 //1 day
    });

    res.redirect("/");

})

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});