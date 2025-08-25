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

// Variation schema
const variationSchema = new mongoose.Schema({
  productQty: { type: Number, default: 0 },
  code: { type: String ,},
  orderTax: { type: Number , default: 0 },
  productCost: { type: Number , default: 0},
  productPrice: { type: Number , default: 0 },
  stockAlert: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  taxType: { type: String , default: 'Exclusive' },
  wholesaleEnabled: { type: Boolean, default: false },
  wholesaleMinQty: { type: Number, default: 0 },
  wholesalePrice: { type: Number, default: 0 },
}, { _id: false });

// Warehouse schema
const warehouseSchema = new mongoose.Schema({
  warehouseName: { type: String,},
  productQty: { type: Number},
  code: { type: String },
  orderTax: { type: Number},
  productCost: { type: Number},
  productPrice: { type: Number},
  discount: { type: Number, default: 0},
  stockAlert: { type: Number},
  taxType: { type: String},
  variationType: { type: String},
  variationValues: { type: Map, of: variationSchema },
  wholesaleEnabled: { type: Boolean, default: false },
  wholesaleMinQty: { type: Number, default: 0 },
  wholesalePrice: { type: Number, default: 0 },
}, { _id: false });

// Product schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  brand: { type: String,  },
  category: { type: String, required: true },
  barcode: { type: String },
  image: { type: String },
  unit: { type: String, required: true },
  saleUnit: { type: String, required: true },
  purchase: { type: String, required: true },
  ptype: { type: String, required: true },
  quantityLimit: { type: Number },
  supplier: { type: String,  },
  warranty: { type: String, default: '' },
  warehouse: { type: Map, of: warehouseSchema },
  variation: { type: String },
  status: { type: String, default: 'Pending' },
  note: { type: String }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
