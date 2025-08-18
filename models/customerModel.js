/*
 * Copyright (c) 2025 Ideazone (Pvt) Ltd
 * Proprietary and Confidential
 *
 * This source code is part of a proprietary Point-of-Sale (POS) system developed by Ideazone (Pvt) Ltd.
 * Use of this code is governed by a license agreement and an NDA.
 * Unauthorized use, modification, distribution, or reverse engineering is strictly prohibited.
 *
 * Contact info@ideazone.lk for more information.
 */

// const mongoose = require('mongoose');
// const newCustomer = new mongoose.Schema({
//     username: {
//         type: String,
//         sparse: true,
//     },
//     name: {
//         type: String,
//         required: true,
//     },
//     nic: {
//         type: String,
//     },
//     mobile: {
//         type: String,
//         required: true,
//         unique: false,
//     },
//     country: {
//         type: String,
//     },
//     city: {
//         type: String,
//     },
//     address: {
//         type: String,
//     },
//     createdAt: {
//         type: Date,
//         default: Date.now,
//     },
// });

// const Customers = mongoose.model('customers', newCustomer);
// module.exports = Customers;


const mongoose = require('mongoose');


const loyaltySchema = new mongoose.Schema({
    loyaltyReferenceNumber: { type: String, required: true, trim: true },
    redeemedPoints: { type: Number, default: 0, min: 0 }
}, { _id: false });


const customerSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    nic: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    loyalty: loyaltySchema, 
    createdAt: { type: Date, default: Date.now }
});

const Customers = mongoose.model('customers', customerSchema);

module.exports = Customers;