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

// models/heldProduct.js
const mongoose = require('mongoose');

// Define the schema for a single held product
const heldProductSchema = new mongoose.Schema({
    currentID:{ type: String, required: true },
    name: { type: String, required: true },
    tax: {type: String},
    ptype:{type:String, required:true},
    variation:{type: String},
    price: { type: String, required: true },
    qty: { type: Number, required: true },
    subTotal: { type: String, required: true },
    warehouse: {type: String, required: true },
    discount: { type: Number, required: true },
    wholesaleEnabled: { type: Boolean, default: false },
    wholesaleMinQty: { type: Number, default: 0 },
    wholesalePrice: { type: String, default: '0' },
});

// Define the schema for the collection of held products
const heldProductsSchema = new mongoose.Schema({
    referenceNo: { type: String, required: true },
    products: [heldProductSchema] // Array of held products
});

// Create the model from the schema
const HeldProducts = mongoose.model('HoldProducts', heldProductsSchema);

module.exports = HeldProducts;
