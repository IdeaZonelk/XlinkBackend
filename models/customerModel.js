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

const mongoose = require('mongoose');
const newCustomer = new mongoose.Schema({
    username: {
        type: String,
        required: false, // Optional for walk-in customers
        sparse: true,
    },
    name: {
        type: String,
        required: true, // Always required
    },
    nic: {
        type: String,
        required: true, // Optional for walk-in
        unique: true,
    },
    mobile: {
        type: String,
        required: true, // Optional for walk-in
        unique: true,
    },
    country: {
        type: String,
        required: false, // Optional for walk-in
    },
    city: {
        type: String,
        required: false, // Optional for walk-in
    },
    address: {
        type: String,
        required: false, // Optional for walk-in
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Customers = mongoose.model('customers', newCustomer);
module.exports = Customers;