const mongoose = require("mongoose");

// Create a unique ID generator function
const generateUniqueId = () => {
  return new mongoose.Types.ObjectId().toString(); // Generates a new ObjectId as string
};

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    default: generateUniqueId, // Automatically generate a unique ID
  },
  name: {
    type: String,
    required: true, // User's name is required
  },
  email: {
    type: String,
    required: true,
    unique: true, // Ensure email is unique
  },
  password: {
    type: String,
    required: true, // User's password is required
  },
  phonenumber: {
    type: String, // Changed to String to accommodate country codes
    required: true, // Phone number is required
  },
  role: {
    type: String,
    required: true, // User role is required
  },
});

// Ensure that email is unique at the database level
userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);
module.exports = User;
