const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const Product = require("./models/Products");
const User = require("./models/User"); // Import the User model
const bcrypt = require("bcrypt");
const session = require("express-session");
const multer = require("multer"); // Import multer
const fs = require('fs');

const App = express();

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Middleware for parsing requests
App.use(express.urlencoded({ extended: true }));
App.use(express.json()); // For parsing application/json
App.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// Configure storage for multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);  // Use the created upload directory
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Set file name based on current time
    },
});

const upload = multer({ storage: storage });


// Endpoint to upload images
App.post('/upload', upload.single('image'), async (req, res) => {
    try {
        res.send('Image uploaded successfully to ' + req.file.path);
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).send('Error uploading image');
    }
});

// Set views
App.set("views", path.join(__dirname, "views"));
App.set("view engine", "ejs");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/Productdb")
    .then(() => console.log("Connected successfully"))
    .catch(err => console.log("Error connecting: ", err));

// Các trang yêu cầu đăng nhập
App.get("/", requireLogin, async (req, res) => {
    const products = await Product.find();
    console.log(products); // Log all products
    res.render("list", { products });
});

App.get("/productlist", requireLogin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const searchQuery = req.query.search || "";

        const filter = {
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { brand: { $regex: searchQuery, $options: 'i' } }
            ]
        };

        const products = await Product.find(filter)
            .skip((page - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE);

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);

        const cart = req.session.cart || [];
        const cartCount = cart.length;

        res.render("productlist", {
            products,
            currentPage: page,
            totalPages,
            searchQuery,
            cartCount,
            cart
        });
    } catch (error) {
        console.log("Error fetching products:", error);
        res.status(500).send("Internal Server Error");
    }
});


// Get all users for the user list page
App.get("/userlist", async (req, res) => {
    const users = await User.find();
    res.render("userlist", { users });
});

// Create new product
App.get("/create", (req, res) => {
    res.render("create");
});

// Handle product creation
App.post("/create", upload.single('image'), async (req, res) => {
    const data = req.body;
    if (req.file) {
        // Lưu đường dẫn tương đối thay vì đường dẫn đầy đủ
        data.image = '/uploads/' + req.file.filename;
    }
    await Product.create(data)
        .then(() => res.redirect("/"))
        .catch(error => console.log("Error creating product:", error));
});


// Get product by ID and update it
App.get("/update/:id", async (req, res) => {
    const product = await Product.findById(req.params.id);
    res.render("update", { product });
});

// Update product with image upload
App.post("/update/:id", upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    if (req.file) {
        // Cập nhật đường dẫn tương đối mới cho hình ảnh
        data.image = '/uploads/' + req.file.filename;
    } else {
        // Nếu không có hình ảnh mới, giữ nguyên đường dẫn hình ảnh cũ
        const existingProduct = await Product.findById(id);
        data.image = existingProduct.image; 
    }

    await Product.findByIdAndUpdate(id, data)
        .then(() => res.redirect("/"))
        .catch(error => console.log("Error updating product:", error));
});
// Delete product by ID
App.post("/delete/:id", async (req, res) => {
    const { id } = req.params;
    await Product.findByIdAndDelete(id)
        .then(() => res.redirect("/"))
        .catch(error => console.log("Error deleting product:", error));
});

// Registration Route
App.get("/register", (req, res) => {
    res.render("register");
});

// Handle user registration
App.post("/register", async (req, res) => {
    const { name, email, password, phonenumber, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
    try {
        await User.create({ name, email, password: hashedPassword, phonenumber, role });
        res.redirect("/userlist");
    } catch (error) {
        console.log("Error registering user:", error);
        res.redirect("/register");
    }
});

// Middleware kiểm tra đăng nhập
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login"); // Nếu chưa đăng nhập, chuyển hướng về trang login
    }
    next(); // Nếu đã đăng nhập, tiếp tục xử lý request
}


// User login route
App.get("/login", (req, res) => {
    res.render("login", { errorMessage: "" }); // Initialize errorMessage as an empty string
});

// Handle user login
App.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render("login", { errorMessage: "Invalid email or password" });
        }
        req.session.userId = user.id;
        res.redirect(user.role === 'Admin' ? "/" : "/productlist");
    } catch (error) {
        console.error("Login error:", error);
        res.render("login", { errorMessage: "An error occurred during login. Please try again." });
    }
});

// Get user by ID and render user details
App.get("/user/:id", async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
        res.render("userDetail", { user });
    } else {
        res.status(404).send("User not found");
    }
});

// Get user by ID and render the update form
App.get("/user/update/:id", async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
        res.render("updateUser", { user });
    } else {
        res.status(404).send("User not found");
    }
});

// Update user details
App.post("/user/update/:id", async (req, res) => {
    const { id } = req.params;
    const { countryCode, phonenumber, ...otherData } = req.body; // Destructure country code and phone number
    const fullPhoneNumber = `+${countryCode}${phonenumber}`; // Combine into full number
    const data = {
        ...otherData,
        phonenumber: fullPhoneNumber // Include the full phone number in the update
    };

    await User.findByIdAndUpdate(id, data, { new: true })
        .then(() => res.redirect("/userlist"))
        .catch(error => {
            console.log("Error updating user:", error);
            res.status(500).send("Error updating user");
        });
});

const ITEMS_PER_PAGE = 10; // Define how many items to display per page


// Add to cart route
App.get("/add-to-cart/:id", async (req, res) => {
    const productId = req.params.id;

    // Initialize cart if it doesn't exist
    if (!req.session.cart) {
        req.session.cart = [];
    }

    // Check if the product is already in the cart
    const productInCart = req.session.cart.find(item => item._id === productId);

    if (!productInCart) {
        // Find the product by ID and add it to the cart with a quantity of 1
        const product = await Product.findById(productId);
        if (product) {
            req.session.cart.push({ ...product.toObject(), quantity: 1 }); // Add quantity field
            console.log(`Added ${product.name} to cart.`);
        }
    } else {
        // Increment the quantity if the product is already in the cart
        productInCart.quantity += 1;
        console.log(`Increased quantity of ${productInCart.name}.`);
    }

    res.redirect("/productlist"); // Redirect back to product list
});

// Product detail route
App.get("/productdetail/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            res.render("productdetail", { product });
        } else {
            res.status(404).send("Product not found");
        }
    } catch (error) {
        console.log("Error fetching product details:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Remove product from cart route
App.delete('/remove-from-cart/:id', (req, res) => {
    const productId = req.params.id;

    if (req.session.cart) {
        const productIndex = req.session.cart.findIndex(item => item._id === productId);

        if (productIndex !== -1) {
            req.session.cart.splice(productIndex, 1);  // Remove the product from the cart
        }
    }

    // Calculate the updated cart count
    const cartCount = req.session.cart ? req.session.cart.length : 0;

    res.json({ cart: req.session.cart, cartCount });  // Return the updated cart and count
});

// Serve static files from uploads directory
App.use('/uploads', express.static(uploadDir));


Product.find({ image: { $exists: false } })

// Start the server
const PORT = 800;
App.listen(PORT, () => {
    console.log(`App is listening on http://localhost:${PORT}`);
});
