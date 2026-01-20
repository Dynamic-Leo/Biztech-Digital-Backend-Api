require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const morgan = require("morgan");
const helmet = require("helmet");
const db = require("./src/models");
const { errorMiddleware } = require("./src/middleware/error.middleware");

const app = express();

// Middleware
app.use(helmet());

app.use(cors({
  origin: [
    "https://digital.biztech.ae",
    "https://www.digital.biztech.ae"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev")); // Logger

// Static Folders
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Basic Route
app.get("/", (req, res) => {
  res.json({ message: "BizTech API is running..." });
});

// Routes
app.use("/api/v1/auth", require("./src/api/auth.routes"));
app.use("/api/v1/admin", require("./src/api/admin.routes"));
app.use("/api/v1/clients", require("./src/api/client.routes"));
app.use("/api/v1/requests", require("./src/api/request.routes"));
app.use("/api/v1/proposals", require("./src/api/proposal.routes"));
app.use("/api/v1/projects", require("./src/api/project.routes"));

// Error Handling
app.use(errorMiddleware);

const PORT = process.env.PORT || 3000;

// Sync DB and Start Server
db.sequelize
  .sync({ alter: true }) 
  .then(() => {
    console.log("✅ Database Connected & Synced");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => console.error("❌ Database Connection Failed:", err));