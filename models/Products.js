const mongoose = require("mongoose");
const { Schema } = mongoose;

const producstSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    brand: {
        type: String,
        required: true,
        trim: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    quantity: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    image: {
        type: String,
        required: false, // Change this to false if you want to allow products without images
        // You can keep the match validation if you prefer URLs only
    },
});

const Product = mongoose.model("Product", producstSchema);
module.exports = Product;
