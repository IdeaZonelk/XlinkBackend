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

const productSchema = new mongoose.Schema({
    currentID: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: String, required: true },
    variationValue: { type: String},
    ptype: { type: String, required: true }, 
    quantity: { type: Number, required: true },
    taxRate: { type: Number},
    subtotal: { type: Number, required: true },
});

const purchaseSchema = new mongoose.Schema({
    refferenceId : { type: String, required: true, unique: true }, 
    supplier: { type: String, required: true },
    invoiceNumber: { type: String},
    date: { type: Date, default: Date.now },
    discountType:{ type: String, required: true },
    discount: { type: String},
    grandTotal: { type: Number, required: true },
    orderStatus: { type: String, required: true },
    paymentStatus: { type: String, required: true },
    paymentType: { type: String, required: true,required: true },
    paidAmount: { type: Number, default: 0 }, 
    productsData: { type: [productSchema], required: true },
    shipping: { type: String },
    tax: { type: String},
    warehouse: { type: String, required: true, default: null },
},
{ timestamps: true } 
);

const Purchase = mongoose.model('purchase', purchaseSchema);

module.exports = Purchase;
