require("dotenv").config();

const express = require("express");
const path = require("path");
const ejsMate = require("ejs-mate");
const flash = require('connect-flash');
const session = require('express-session');
// const MongoStore = require("connect-mongo");
const pgSession = require("connect-pg-simple")(session);
const passport = require('passport');
const LocalStrategy = require('passport-local');
const methodOverride = require("method-override");
const bcrypt = require("bcrypt");
const ExpressError = require('./utils/expressError')
const catchAsync = require('./utils/catchAsync');
const db = require("./db/index");
const { isLoggedIn, isUser } = require("./middleware")

const app = express();

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

const secret = process.env.SECRET || 'thisshouldbeabettersecret';
// const dbURL = process.env.DBURL || "mongodb://localhost:27017/pantryTracker";

// session storage in MongoDB
// const store = MongoStore.create({
//     mongoUrl: dbURL,
//     touchAfter: 24 * 60 * 60,
//     crypto: {
//         secret: secret,
//     }
// });

const sessionConfig = {
    store: new pgSession({
        pool: db,
        tableName: "session",
    }),
    name: 'SID',
    secret: secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + (1000 * 60 * 60 * 24 * 7),
        maxAge: 1000 * 60 * 60 * 24 * 7,
    }
}
app.use(session(sessionConfig));
app.use(flash());

// passport config
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
},
    (username, password, done) => {
        db.query("SELECT id, username, email, password FROM users WHERE username=$1", [username], (e, result) => {
            if (e) {
                return done(new ExpressError(e.message));
            }
            if (result.rows.length === 0) {
                return done(null, false, { message: 'Wrong user name or password' });
            }
            const hashedPassword = result.rows[0].password;
            const user = result;
            bcrypt.compare(password, hashedPassword, function (e, result) {
                if (e) {
                    return done(new ExpressError(e.message));
                }
                if (result == true) {
                    return done(null, user);
                } else {
                    return done(null, false, { message: 'Wrong user name or password' });
                }
            });
        })
    }));
passport.serializeUser((user, done) => {
    done(null, user.rows[0].id);
});
passport.deserializeUser((id, done) => {
    db.query("SELECT id, username, email FROM users " +
        "WHERE id = $1", [id])
        .then((user) => {
            done(null, user);
        })
        .catch((err) => {
            done(new Error(`User with the id ${id} does not exist`));
        })
});

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// render index of all products
app.get("/", catchAsync(async (req, res) => {
    let products = null;
    if (!req.user) {
        products = [];
    } else {
        const productsQuery = await db.query("SELECT * FROM products WHERE userId = $1 ORDER BY name ASC", [req.user.rows[0].id]);
        products = productsQuery.rows;
    }
    res.render("products", { products });
}));

// render list of "ran out" products
app.get("/ranOut", isLoggedIn, catchAsync(async (req, res) => {
    const productsQuery = await db.query("SELECT * FROM products where qty = 0");
    const products = productsQuery.rows;
    res.render("ranOut", { products });
}))

// add a new product
app.post("/", isLoggedIn, catchAsync(async (req, res) => {
    const { name, category, qty } = req.body.product;
    const results = await db.query("INSERT INTO products(userId, name, category, qty) VALUES($1, $2, $3, $4) RETURNING *", [req.user.rows[0].id, name, category, qty]);
    res.redirect("/");
}));

// removes a product
app.delete("/:id", isLoggedIn, isUser, catchAsync(async (req, res) => {
    const { id } = req.params;
    const product = await db.query("DELETE FROM products WHERE id=$1", [id]);
    res.redirect("/");
}));

// decrement qty of product
app.put("/:id/decrement", isLoggedIn, isUser, catchAsync(async (req, res) => {
    const { id } = req.params;
    const productQty = await db.query("SELECT qty FROM products WHERE id = $1", [id])
    const newQty = productQty.rows[0].qty - 1;
    const product = await db.query("UPDATE products SET qty = $1 WHERE id = $2", [newQty, id]);
    res.redirect("/");
}))

// increment qty of product
app.put("/:id/increment", isLoggedIn, isUser, catchAsync(async (req, res) => {
    const { id } = req.params;
    const productQty = await db.query("SELECT qty FROM products WHERE id = $1", [id])
    const newQty = productQty.rows[0].qty + 1;
    const product = await db.query("UPDATE products SET qty = $1 WHERE id = $2", [newQty, id]);
    res.redirect("/");
}))

// rendering register form
app.get("/register", (req, res) => {
    res.render('./users/register');
});

// registering
app.post("/register", catchAsync(async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 12);
        const registeredUser = await db.query("INSERT INTO users(email, username, password) VALUES($1, $2, $3) RETURNING *", [email, username, hashedPassword]);
        req.login(registeredUser, err => {
            if (err) {
                return next(err);
            }
        });
        req.flash('success', 'Welcome to PantryTracker!');
        res.redirect('/');
    } catch (e) {
        // e.message = "A user with the given email, username, or password is already registered";
        req.flash('error', e.message);
        res.redirect('/register');
    }
}));

// rendering login form
app.get("/login", (req, res) => {
    res.render('users/login');
});

// logging in
app.post("/login", passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), (req, res) => {
    req.flash('success', 'welcome back!');
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
});

// logging out
app.get("/logout", (req, res) => {
    req.logout();
    req.flash('success', "Goodbye!");
    res.redirect('/');
});

// error page
app.all('*', (req, res, next) => {
    next(new ExpressError('Page Not Found', 404));
})
app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) {
        err.message = 'Oh No, Something went Wrong!';
    }
    res.status(statusCode).render('error', { err });
})

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log("Serving...");
})