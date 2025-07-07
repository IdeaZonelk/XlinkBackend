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

// models/ReceiptSettings.js

const mongoose = require('mongoose');

const receiptSettingsSchema = new mongoose.Schema({
    note: { type: Boolean, default: false },
    phone: { type: Boolean, default: false },
    customer: { type: Boolean, default: false },
    address: { type: Boolean, default: false },
    email: { type: Boolean, default: false },
    taxDiscountShipping: { type: Boolean, default: false },
    barcode: { type: Boolean, default: false },
    productCode: { type: Boolean, default: false },
    logo: { type: Boolean, default: false },
    template: { type: String, required: true},
});

// Create a model from the schema
const ReceiptSettings = mongoose.model('ReceiptSettings', receiptSettingsSchema);
module.exports = ReceiptSettings;
