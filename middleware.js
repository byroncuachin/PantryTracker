const db = require("./db/index");

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash('error', 'You must be signed in first!');
        return res.redirect('/login');
    }
    next();
}

module.exports.isUser = async (req, res, next) => {
    const { id } = req.params;
    const product = await db.query("SELECT * FROM products WHERE id=$1", [id]);
    if (product.rows[0].userid !== req.user.rows[0].id) {
        req.flash('error', 'You do not have permission to do that!');
        return res.redirect("/");
    }
    next();
}
