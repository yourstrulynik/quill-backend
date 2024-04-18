// Port Info and MonogoDB connection URL
const { PORT, mongodbURL } = require("./config.js");

// Libraries
const express = require("express");
const app = express();
const mongoose = require("mongoose");

const jwt = require("jsonwebtoken");
const cors = require("cors");

const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

// File System
const fs = require("fs");

// Model
const User = require("./model/User.js");
const Post = require("./model/Post.js");

// Cloudinary
const cloudinary = require("./cloudinary.js");

// multer middleware
const upload = require("./middleware/multer.js");

const salt = bcrypt.genSaltSync(10);
const jwtString = "asdfghjklzxcvbnm";

app.use(cors({ credentials: true, origin: ["https://quill-backend.onrender.com","http://localhost:5173"] }));
app.use(express.json());
app.use(cookieParser());

// Connection to DB
mongoose
  .connect(mongodbURL)
  .then(() => {
    console.log("App connected to database.");
    app.listen(PORT, () => {
      console.log(`App is listening to port: ${PORT}`);
    });
  })
  .catch((error) => {
    console.log(error);
    console.log("connection to database failed");
  });

// Register API
app.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, password2 } = req.body;

    if (!fullName || !email || !password || !password2) {
      return res.status(400).json({ error: "All fields are required!" });
    }
    if (password.trim().length < 6) {
      return res
        .status(400)
        .json({ error: "Password should contain atleast 6 charcters." });
    }
    if (password !== password2) {
      return res.status(400).json({ error: "Passwords do not match!" });
    }
    const emailExists = await User.findOne({ email: email });
    if (emailExists) {
      return res.status(400).json({ error: "E-mail already exists!" });
    }
    await User.create({
      fullName,
      email,
      password: bcrypt.hashSync(password, salt),
    });
    res.json("User Regisetered");
  } catch (error) {
    console.log(error.message);
  }
});

// Login API
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const userDoc = await User.findOne({ email });
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign(
        {
          email,
          id: userDoc._id,
          name: userDoc.fullName,
        },
        jwtString,
        {},
        (err, token) => {
          if (err) {
            throw err;
          } else {
            res.cookie("token", token).json("Logged In");
          }
        }
      );
    } else {
      return res
        .status(400)
        .json({ error: "Invalid username or password. Please try again." });
    }
  } catch (error) {
    res.json(error.message);
    console.log(error);
  }
});

// Authentication API
app.get("/profile", (req, res) => {
  try {
    const { token } = req.cookies;
    jwt.verify(token, jwtString, {}, (err, info) => {
      if (err) throw err;
      res.json(info);
    });
  } catch (error) {
    res.json(error.message);
  }
});

// Logout API
app.post("/logout", (req, res) => {
  res.cookie("token", "").json("Logged Out");
});

// Upload Post API
app.post("/post", upload.single("file"), async (req, res) => {
  try {
    const { title, summary, content, category } = req.body;
    if (!title || !summary || !content || !category || !req.file) {
      return res.status(400).json({ error: "All fields are required!" });
    }
    const { token } = req.cookies;
    jwt.verify(token, jwtString, {}, async (err, info) => {
      if (err) throw err;

      // cloudinary upload
      const url = await cloudinary.uploader.upload(
        req.file.path,
        function (err, result) {
          if (err) {
            console.log(err);
            res.status(400).json({ error: "Thumbnail was not uploaded" });
          }
        }
      );

      await Post.create({
        title,
        summary,
        content,
        cover: url.secure_url ? url.secure_url : " ",
        author: info.id,
        category: category,
      });
      const currentUser = await User.findById(info.id);
      const userPostCount = currentUser.postCount + 1;
      await User.findByIdAndUpdate(info.id, { postCount: userPostCount });
      res.json("Post Created");
    });
  } catch (error) {
    console.log(error);
  }
});

// Show all Post API
app.get("/post", async (req, res) => {
  try {
    const Posts = await Post.find()
      .populate("author", ["fullName", "avatar"])
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(Posts);
  } catch (error) {
    console.log(error.message);
  }
});

//Show Single Post API
app.get("/post/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const postDoc = await Post.findById(id).populate("author", ["fullName"]);
    res.json(postDoc);
  } catch (error) {
    console.log(error.message);
  }
});

// Show Profile Info API
app.get("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userDoc = await User.findById(id).select("-password");
    res.json({ userDoc });
  } catch (error) {
    console.log(error);
  }
});

// Update Profile Info API
app.put("/profile/:id", upload.single("avatar"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, oldPass, newPass, confirmNewPass } = req.body;
    const userDoc = await User.findById(id);

    if (req.file) {
      const url = await cloudinary.uploader.upload(
        req.file.path,
        function (err, result) {
          if (err) {
            console.log(err);
            res.status(400).json({ error: "Thumbnail was not uploaded" });
          }
        }
      );
      if (url) {
        await userDoc.updateOne({
          avatar: url?.secure_url,
        });
      }
      // console.log(url);
    }
    if (oldPass !== "" && newPass !== "" && confirmNewPass !== "") {
      const passOk = bcrypt.compareSync(oldPass, userDoc.password);
      if (!passOk) {
        return res.status(400).json({ error: "Old Password is incorrect!" });
      }

      if (newPass.trim().length < 6) {
        return res
          .status(400)
          .json({ error: "Password should contain atleast 6 charcters." });
      }
      if (newPass !== confirmNewPass) {
        return res.status(400).json({ error: "Passwords do not match!" });
      }
      await userDoc.updateOne({
        password: bcrypt.hashSync(newPass, salt),
      });
    }

    if (email !== userDoc.email && email !== "") {
      const emailExists = await User.findOne({ email: email });
      if (emailExists) {
        return res.status(400).json({ error: "E-mail already exists!" });
      } else {
        await userDoc.updateOne({
          email: email,
        });
      }
    }
    if (name !== userDoc.fullName && name !== "") {
      await userDoc.updateOne({
        fullName: name,
      });
    }

    res.json("updated successfully");
  } catch (error) {
    console.log(error);
  }
});

// Update Post API
app.put("/post", upload.single("file"), async (req, res) => {
  try {
    const { token } = req.cookies;
    let url = null;
    jwt.verify(token, jwtString, {}, async (err, info) => {
      if (err) throw err;
      // cloudinary upload
      if (req.file) {
        const url = await cloudinary.uploader.upload(
          req.file.path,
          function (err, result) {
            if (err) {
              console.log(err);
              res.status(400).json({ error: "Thumbnail was not uploaded" });
            }
          }
        );
      }
      const { id, title, summary, content } = req.body;
      const postDoc = await Post.findById(id);
      const isAuthor =
        JSON.stringify(postDoc.author) === JSON.stringify(info.id);
      if (!isAuthor) {
        return res.status(400).json("you are not the author");
      }
      await postDoc.updateOne({
        title,
        summary,
        content,
        cover: url?.secure_url ? url?.secure_url : postDoc.cover,
      });
      res.json(postDoc);
    });
  } catch (error) {
    console.log(error);
  }
});

// Delete Post API
app.delete("/post/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    const currentUser = await User.findById(post.author._id);
    await Post.findByIdAndDelete(id);
    const newPostCount = currentUser.postCount - 1;
    await User.findByIdAndUpdate(post.author._id, { postCount: newPostCount });
    res.status(200).json("Post deleted.");
  } catch (error) {
    console.log(error);
    res.status(400).json("Post can not be deleted!");
  }
});
