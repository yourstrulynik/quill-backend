const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const UserSchema = new Schema({
  fullName: { type: String, required: true, min: 3 },
  email: { type: String, required: true, min: 3 },
  password: { type: String, required: true, min: 6 },
  postCount: { type: Number, default: 0 },
  avatar: { type: String, default: "" },
});

const UserModel = model("User", UserSchema);

module.exports = UserModel;
