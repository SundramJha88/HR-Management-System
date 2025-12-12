require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const documentRoutes = require("./routes/documentRoutes");
const newhireRoutes = require("./routes/newhireRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use("/auth", authRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/leave", leaveRoutes);
app.use("/documents", documentRoutes);
app.use("/newhire", newhireRoutes);
app.use("/admin", adminRoutes);
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => res.send("VAAU Backend Running"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
