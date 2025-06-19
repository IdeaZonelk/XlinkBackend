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
    ptype: { type: String, required: true }, 
    variationValue: { type: String},
    quantity: { type: Number, required: true },
    taxRate: { type: Number},
    discount: { type: Number},
    subtotal: { type: Number, required: true },
    warehouse: { type: String, required: true },
    wholesaleEnabled: { type: Boolean, default: false },
    wholesaleMinQty: { type: Number, default: 0 },
    wholesalePrice: { type: Number, default: 0 },
});

const quatationSchema = new mongoose.Schema({
    customer: { type: String, required: true },
    date: { type: Date, default: Date.now },
    discountType:{ type: String},
    discount: { type: String},
    grandTotal: { type: Number, required: true },
    orderStatus: { type: String, required: true },
    paymentStatus: { type: String, required: true },
    paymentType: { type: String, required: true },
    paidAmount: { type: Number, default: 0 }, 
    productsData: { type: [productSchema], required: true },
    shipping: { type: String},
    tax: { type: String},
    warehouse: { type: String, default: null },
    statusOfQuatation:{type:Boolean, required:true}
},
{ timestamps: true } 
);

const Quatation = mongoose.model('quatation', quatationSchema);
module.exports = Quatation;
