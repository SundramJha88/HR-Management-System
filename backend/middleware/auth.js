require("dotenv").config();
const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const token = req.header("auth-token");
  if (!token) return res.status(401).json({ error: "Access Denied" });

  try {
    const secret = process.env.JWT_SECRET || "secret123";
    const verified = jwt.verify(token, secret);
    req.user = verified; // contains e.g. { id, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid Token" });
  }
};
