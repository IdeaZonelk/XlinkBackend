const mongoose = require('mongoose');
const newCustomer = new mongoose.Schema({
    username: {
        type: String,
        sparse: true,
    },
    name: {
        type: String,
        required: true,
    },
    nic: {
        type: String,
    },
    mobile: {
        type: String,
        required: true,
        unique: false,
    },
    country: {
        type: String,
    },
    city: {
        type: String,
    },
    address: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Customers = mongoose.model('customers', newCustomer);
module.exports = Customers;