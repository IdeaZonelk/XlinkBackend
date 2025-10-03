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

const HeldProducts = require('../../models/posModel/holdProductModel');
const Product = require('../../models/products/product');
const { ObjectId } = require('mongodb');
const Cash = require('../../models/posModel/cashModel');
const User = require('../../models/userModel');
const Permissions = require('../../models/rolesPermissionModel');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const ZReading = require('../../models/zBillRecord');
const mongoose = require('mongoose');
const { log } = require('console');
const { formatToSriLankaTime } = require('../../utils/timeZone');

const cashHandIn = async (req, res) => {
    const { cashAmount, username, name,
        oneRupee, twoRupee, fiveRupee, tenRupee, twentyRupee, fiftyRupee, hundredRupee, fiveHundredRupee, thousandRupee, fiveThousandRupee } = req.body;
    try {
        const existingUser = await Cash.findOne({ username });
        if (existingUser) {
            return res.status(400).json({
                status: 'fail',
                message: 'Username already exists. Please use a different username.'
            });
        }
        const currentCash = await Cash.findOne();

        // Use server UTC time for openTime like other controllers
        const openTime = new Date();

        if (currentCash) {
            currentCash.totalBalance += cashAmount;
            currentCash.cashHandIn = cashAmount; // Keep track of the total cash added
            await currentCash.save();
            return res.status(200).json({ message: 'Cash updated successfully', cash: currentCash });
        } else {
            const newCash = new Cash({
                username,
                name,
                openTime,
                cashHandIn: cashAmount,
                totalBalance: cashAmount,
                oneRupee, twoRupee, fiveRupee, tenRupee, twentyRupee, fiftyRupee, hundredRupee, fiveHundredRupee, thousandRupee, fiveThousandRupee
            });
            await newCash.save();
            
            // Log formatted cash register opening time
            const formattedOpenTime = formatToSriLankaTime(openTime);
            console.log("✅ Cash Register Opened Successfully:", {
                username: username,
                cashierName: name,
                openedAt: formattedOpenTime.full,
                openedAtISO: formattedOpenTime.iso,
                cashHandIn: cashAmount,
                timezone: "Sri Lanka Time (UTC+05:30)"
            });
            
            return res.status(201).json({ message: 'New cash record created successfully', cash: newCash });
        }
    } catch (error) {
        console.error('Error updating cash:', error);
        // Structured error response
        return res.status(500).json({
            message: 'An error occurred while updating cash.',
            error: error.message,
        });
    }
};

const closeRegister = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedRegister = await Cash.findByIdAndDelete(id);
        if (!deletedRegister) {
            return res.status(404).json({ status: "Not Found", message: "Registry not found" });
        }
        res.json({ status: "Success", message: "Registry deleted" });
    } catch (error) {
        console.error('Error deleting registry:', error);
        // Structured error response
        return res.status(500).json({
            message: 'An error occurred while deleting cash registry.',
            error: error.message,
        });
    }
}

const findAllProductsForPos = async (req, res) => {
    try {
        const products = await Product.find();
        if (!products.length) {
            return res.status(404).json({ status: 'No products found' });
        }
        // Map through products to format variationValues and other fields
        const Allproduct = products.map(product => {
            const productObj = product.toObject();

            // Format the createdAt date using timezone utility
            const formattedCreatedAtTime = formatToSriLankaTime(productObj.createdAt);
            const formattedCreatedAt = formattedCreatedAtTime.dateOnly;

            // Convert variationValues Map to a regular object
            const formattedVariationValues = {};
            if (productObj.variationValues) {
                productObj.variationValues.forEach((value, key) => {
                    formattedVariationValues[key] = value;
                });
            }

            // Convert image to base64 data URL if it exists
            let imageUrl = null;
            if (productObj.image) {
                imageUrl = `${req.protocol}://${req.get('host')}/uploads/product/${path.basename(productObj.image)}`;
            }
            return {
                _id: productObj._id,
                name: productObj.name,
                code: productObj.code,
                brand: productObj.brand,
                category: productObj.category,
                barcode: productObj.barcode,
                unit: productObj.unit,
                saleUnit: productObj.saleUnit,
                purchase: productObj.purchase,
                ptype: productObj.ptype,
                status: productObj.status,
                quantityLimit: productObj.quantityLimit,
                suplier: productObj.suplier,
                warehouse: productObj.warehouse,
                variation: productObj.variation,
                variationType: productObj.variationType,
                variationValues: formattedVariationValues,
                note: productObj.note,
                productCost: productObj.productCost,
                productPrice: productObj.productPrice,
                productQty: productObj.productQty,
                oderTax: productObj.oderTax,
                taxType: productObj.taxType,
                stockAlert: productObj.stockAlert,
                image: imageUrl,  // Use the base64 encoded image here
                createdAt: formattedCreatedAt
            };
        });

        // Return the formatted products in the response
        return res.status(200).json({ status: 'Products fetched successfully', products: Allproduct });
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ status: 'Error fetching products', error: error.message });
    }
};

// Find product by a keyword
const findProductByKeyword = async (req, res) => {
    const { keyword } = req.query; // Extract keyword from query params
    try {
        // Infer searchType based on keyword format
        let searchType;
        if (/^\d+$/.test(keyword)) {
            // If keyword is numeric, assume it's a code
            searchType = 'code';
        } else if (keyword.length > 0) {
            // Otherwise, assume it's a name (if it's not empty)
            searchType = 'name';
        } else {
            return res.status(400).json({ status: 'Bad Request', message: 'Invalid keyword' });
        }

        let product;
        if (searchType === 'code') {
            // Search by product code
            product = await Product.findOne({ code: keyword });
        } else if (searchType === 'name') {
            // Search by product name
            product = await Product.findOne({ name: keyword });
        }

        if (!product) {
            return res.status(404).json({ status: 'Not Found', message: 'Product not found' });
        }

        const productObj = product.toObject();

        // Format the createdAt date using timezone utility
        const formattedCreatedAtTime = formatToSriLankaTime(productObj.createdAt);
        const formattedCreatedAt = formattedCreatedAtTime.dateOnly;

        // Convert variationValues Map to a regular object
        const formattedVariationValues = {};
        if (productObj.variationValues) {
            productObj.variationValues.forEach((value, key) => {
                formattedVariationValues[key] = value;
            });
        }

        // Convert image to base64 data URL if it exists
        let imageUrl = null;
        if (productObj.image) {
            imageUrl = `${req.protocol}://${req.get('host')}/uploads/product/${path.basename(productObj.image)}`;
        }
        res.json({
            status: "Success",
            product: {
                _id: productObj._id,
                name: productObj.name,
                code: productObj.code,
                brand: productObj.brand,
                category: productObj.category,
                barcode: productObj.barcode,
                unit: productObj.unit,
                saleUnit: productObj.saleUnit,
                purchase: productObj.purchase,
                ptype: productObj.ptype,
                status: productObj.status,
                quantityLimit: productObj.quantityLimit,
                suplier: productObj.suplier,
                warehouse: productObj.warehouse,
                variation: productObj.variation,
                variationType: productObj.variationType,
                variationValues: formattedVariationValues,
                note: productObj.note,
                productCost: productObj.productCost,
                productPrice: productObj.productPrice,
                productQty: productObj.productQty,
                oderTax: productObj.oderTax,
                taxType: productObj.taxType,
                stockAlert: productObj.stockAlert,
                image: imageUrl,  // Include the base64 encoded image
                createdAt: formattedCreatedAt
            }
        });
    } catch (err) {
        res.status(500).json({ status: "Error", error: err.message });
        console.error("Error finding product:", err);
    }
};

const generateReferenceNo = async (req, res) => {
    try {
        let referenceNo;
        let isUnique = false;

        while (!isUnique) {
            referenceNo = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
            const existingRef = await HeldProducts.findOne({ referenceNo });
            if (!existingRef) {
                isUnique = true;
            }
        }
        res.status(200).json({ referenceNo });
    } catch (error) {
        console.error('Error generating reference number:', error);
        res.status(500).json({ message: 'Error generating reference number', error: error.message });
    }
};

const holdProducts = async (req, res) => {
    const { referenceNo, products } = req.body; // Extracting data from the request body

    // Validate the input
    if (!referenceNo || !Array.isArray(products)) {
        return res.status(400).json({ message: 'Invalid input data' });
    }
    try {
        // Create a new instance of the HeldProducts model
        const heldProducts = new HeldProducts({ referenceNo, products });

        // Save the data to the database
        await heldProducts.save();

        // Respond with the saved data
        res.status(201).json({ message: 'Products held successfully', data: heldProducts });
    } catch (error) {
        console.error('Error holding products:', error);
        // Structured error response
        return res.status(500).json({
            message: 'An error occurred while holding products.',
            error: error.message,
        });
    }
};

const viewAllHeldProducts = async (req, res) => {
    try {
        const heldProducts = await HeldProducts.find();

        if (!heldProducts || heldProducts.length === 0) {
            return res.status(404).json({ message: 'No held products found' });
        }

        const currentIds = heldProducts.flatMap(heldProduct =>
            heldProduct.products.map(product => product.currentID)
        );
        const baseProducts = await Product.find({ _id: { $in: currentIds } });

        // Create a map for quick lookup of base product details by currentID and warehouse
        const baseProductMap = baseProducts.reduce((acc, product) => {
            acc[product._id.toString()] = product.warehouse;
            return acc;
        }, {});

        const combinedData = heldProducts.map(heldProduct => ({
            _id: heldProduct._id,
            referenceNo: heldProduct.referenceNo,
            products: heldProduct.products.map(product => {
                const warehouseDetails = baseProductMap[product.currentID] ? baseProductMap[product.currentID].get(product.warehouse) : {};
                let stokeQty = warehouseDetails ? warehouseDetails.productQty : 0;
                let price = warehouseDetails ? warehouseDetails.productPrice : 0;
                let variationValues = warehouseDetails ? warehouseDetails.variationValues : {};

                if (product.variation && variationValues) {
                    const variationDetails = variationValues.get(product.variation);
                    if (variationDetails) {
                        stokeQty = variationDetails.productQty || 0;
                        price = variationDetails.productPrice || 0;
                    }
                }

                return {
                    id: product._id, // Use the ID from the held product
                    currentID: product.currentID,
                    name: product.name || '',
                    variation: product.variation || '',
                    ptype: product.ptype,
                    tax: product.tax,
                    stokeQty,
                    price,
                    purchaseQty: product.qty || 0,
                    discount: product.discount || 0,
                    warehouse: product.warehouse,
                    variationValues,
                    subTotal: price * (product.qty || 0),
                    wholesaleEnabled: product.wholesaleEnabled || false,
                    wholesaleMinQty: product.wholesaleMinQty || 0,
                    wholesalePrice: product.wholesalePrice || 0,
                };
            }),
        }));

        console.log(combinedData);

        res.status(200).json({
            message: 'Held products retrieved successfully',
            data: combinedData,
        });
    } catch (error) {
        console.error('Error retrieving held products:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const deleteHeldProduct = async (req, res) => {
    const { id } = req.params;

    // Validate the id parameter
    if (!id || id === "undefined") {
        return res.status(400).json({ message: 'Invalid product ID provided' });
    }

    // Validate ObjectId format
    const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(id);
    if (!isValidObjectId) {
        return res.status(400).json({ message: 'Invalid product ID format' });
    }

    try {
        // Find and delete the held product by ID
        const deletedProduct = await HeldProducts.findByIdAndDelete(id);

        if (!deletedProduct) {
            return res.status(404).json({ message: 'Held product not found' });
        }

        // Respond with success
        res.status(200).json({ message: 'Held product deleted successfully' });
    } catch (error) {
        console.error('Error deleting held product:', error);
        return res.status(500).json({
            message: 'An error occurred while deleting held product.',
            error: error.message,
        });
    }
};

const getProductsByIds = async (req, res) => {
    const { ids } = req.body;
    try {
        const products = await Product.find({ _id: { $in: ids } });

        if (!products.length) {
            return res.status(404).json({ status: 'No products found for these IDs' });
        }
        const productsData = products.map(product => {
            const productObj = product.toObject();
            const formattedCreatedAtTime = productObj.createdAt ? formatToSriLankaTime(productObj.createdAt) : null;
            const formattedCreatedAt = formattedCreatedAtTime ? formattedCreatedAtTime.dateOnly : null;

            const formattedVariationValues = {};
            if (productObj.variationValues) {
                productObj.variationValues.forEach((value, key) => {
                    formattedVariationValues[key] = value;
                });
            }
            let imageUrl = null;
            if (productObj.image) {
                imageUrl = `${req.protocol}://${req.get('host')}/uploads/product/${path.basename(productObj.image)}`;
            }
            return {
                _id: productObj._id,
                name: productObj.name,
                code: productObj.code,
                quantity: productObj.productQty,
                variationValues: formattedVariationValues,
                image: imageUrl,
                createdAt: formattedCreatedAt
            };
        });
        return res.status(200).json({ status: 'Products fetched successfully', products: productsData });
    } catch (error) {
        console.error('Error fetching products by IDs:', error);
        return res.status(500).json({ status: 'Error fetching products by IDs', error: error.message });
    }
};

const updateProductQuantities = async (req, res) => {
    const productDetails = req.body.products;

    try {
        // Check if products is a valid array
        if (!Array.isArray(productDetails) || productDetails.length === 0) {
            return res.status(400).json({ status: 'Error', message: 'Invalid or empty products array' });
        }

        // Prepare update promises
        const updatePromises = productDetails.map(async (product) => {
            const { curruntID, qty, ptype, variationValue } = product; // Destructure the incoming data

            // Validate the current ID
            if (!ObjectId.isValid(curruntID)) {
                throw new Error(`Invalid product ID: ${curruntID}`);
            }

            // Check for valid quantity
            if (typeof qty !== 'number' || qty < 0) {
                throw new Error(`Invalid quantity for product with ID: ${curruntID}`);
            }

            // Update logic based on product type
            if (ptype === 'Single') {
                // For Single products, reduce productQty by the purchasing quantity
                const updatedProduct = await Product.findById(curruntID);
                if (!updatedProduct) {
                    throw new Error(`Product not found with ID: ${curruntID}`);
                }

                // Reduce the stock quantity
                if (updatedProduct.productQty < qty) {
                    return res.status(400).json({ error: `Insufficient stock for product with ID: ${curruntID}` });
                    //throw new Error(`Insufficient stock for product with ID: ${curruntID}`);
                }

                updatedProduct.productQty -= qty; // Deduct the purchasing quantity from stock
                await updatedProduct.save(); // Save the changes to the product
                return updatedProduct; // Return updated single product
            } else if (ptype === 'Variation' && variationValue) {
                // For Variation products, update the quantity in variationValues
                const updatedProduct = await Product.findById(curruntID);
                if (!updatedProduct) {
                    //throw new Error(`Product not found with ID: ${curruntID}`);
                    return res.status(404).json({ error: `Product not found with ID: ${curruntID}` });
                }

                // Check if the specified variation exists
                const variationKey = variationValue; // e.g., 'M', 'XL'
                const variation = updatedProduct.variationValues.get(variationKey);

                if (!variation) {
                    throw new Error(`Variation ${variationKey} not found for product with ID: ${curruntID}`);
                }

                // Update the productQty in the variation
                variation.productQty -= qty; // Subtract the quantity purchased
                if (variation.productQty < 0) {
                    return res.status(400).json({ error: `Insufficient stock for product with ID: ${curruntID}` });
                    //throw new Error(`Insufficient stock for variation ${variationKey} of product with ID: ${curruntID}`);
                }

                // Save the updated product with updated variation
                await updatedProduct.save(); // Save the changes made to the variations
                return updatedProduct; // Return updated variation product
            } else {
                throw new Error(`Invalid product type or variation value for product with ID: ${curruntID}`);
            }
        });

        await Promise.all(updatePromises); // Wait for all updates to complete

        res.status(200).json({ status: 'Success', message: 'Product quantities updated successfully' });
    } catch (error) {
        console.error('Error updating product quantities:', error);
        // Structured error response
        return res.status(500).json({
            message: 'An error occurred while updating product quantities.',
            error: error.message,
        });
    }
};

const findProducts = async (req, res) => {
    try {
        const { warehouse, brand, category, keyword } = req.query; // Extract filters from query params

        // Build the query object based on provided filters
        const query = {};
        if (warehouse) {
            query[`warehouse.${warehouse}`] = { $exists: true }; // Correct way to filter warehouse
        }
        if (brand) query.brand = brand;
        if (category) query.category = category;
        if (keyword) {
            // Escape special characters in keyword for regex
            const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const normalizedKeyword = escapeRegExp(keyword.trim());

            // Check if the keyword matches a name or code
            query.$or = [
                { name: new RegExp(normalizedKeyword, 'i') }, // Partial case-insensitive match for name
                { code: normalizedKeyword },                 // Exact match for code
            ];
        }

        // Fetch products based on the query
        const products = await Product.find(query).lean(); // Use .lean() to get plain objects

        if (!products.length) {
            return res.status(404).json({ status: 'No products found for the specified criteria' });
        }

        // Format the products
        const formattedProducts = products.map((product) => {
            const productObj = { ...product };

            // Format the createdAt date using timezone utility
            const formattedCreatedAtTime = productObj.createdAt ? formatToSriLankaTime(productObj.createdAt) : null;
            productObj.createdAt = formattedCreatedAtTime ? formattedCreatedAtTime.dateOnly : null;

            // Ensure warehouse information is correctly included
            if (productObj.warehouse && typeof productObj.warehouse === 'object') {
                Object.keys(productObj.warehouse).forEach((warehouseName) => {
                    const warehouseData = productObj.warehouse[warehouseName];

                    // Convert variationValues (if present) from Map to Object
                    if (warehouseData.variationValues instanceof Map) {
                        const formattedVariationValues = {};
                        warehouseData.variationValues.forEach((value, key) => {
                            formattedVariationValues[key] = value;
                        });
                        warehouseData.variationValues = formattedVariationValues;
                    }
                });
            }

            // Convert image to proper URL if it exists
            productObj.image = productObj.image
                ? `${req.protocol}://${req.get('host')}/uploads/product/${path.basename(productObj.image)}`
                : null;

            return productObj;
        });

        return res.status(200).json({ status: 'Products fetched successfully', products: formattedProducts });

    } catch (error) {
        console.error('Error finding products:', error);
        return res.status(500).json({
            message: 'An error occurred while finding products.',
            error: error.message,
        });
    }
};

const getAdminPasswordForDiscount = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username and password are required.');
    }
    try {
        // Fetch user by username
        const user = await User.findOne({ username: username });
        if (!user) {
            return res.status(404).send('User not found.');
        }

        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).send('Invalid password.');
        }

        // Fetch user role and corresponding permissions
        const rolePermissions = await Permissions.findOne({ roleName: user.role });
        if (!rolePermissions) {
            return res.status(404).send('Role permissions not found.');
        }

        const permissions = rolePermissions.permissions;
        console.log('Permissions:', permissions); // Enhanced logging

        if (!permissions || !(permissions instanceof Map)) {
            console.error('Permissions are not a Map:', permissions);
            return res.status(500).send('Server error. Please try again later.');
        }

        const manageOffers = permissions.get('manageOffers');
        console.log('Manage Offers:', manageOffers); // Enhanced logging

        if (manageOffers && manageOffers.assign_offer) {
            console.log('Assign Offer:', manageOffers.assign_offer); // Enhanced logging
            return res.status(200).send({ status: 'success' });
        } else {
            return res.status(403).send('Insufficient permissions.');
        }
    } catch (error) {
        console.error('Error in getAdminPasswordForDiscount:', error);
        res.status(500).send('Server error. Please try again later.');
    }
};

const saveZReading = async (req, res) => {
    // Use server UTC time for closed time
    const closedTime = new Date();
    try {
        const records = Array.isArray(req.body) ? req.body : [req.body];

        if (records.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No records provided in request body'
            });
        }
        const validRegisters = [];
        const failedRecords = [];

        for (const [index, record] of records.entries()) {
            const requiredFields = ['cashRegisterID', 'cashierName', 'openedTime', 'totalAmount', 'grandTotal'];
            const missingFields = requiredFields.filter(field =>
                record[field] === undefined || record[field] === null || record[field] === ''
            );

            if (missingFields.length > 0) {
                failedRecords.push({
                    index,
                    message: `Missing required fields: ${missingFields.join(', ')}`
                });
                continue;
            }

            const sanitizedInputs = (Array.isArray(record.inputs) ? record.inputs : []).map(input => ({
                denomination: Number(input.denomination) || 0,
                quantity: Number(input.quantity) || 0,
                amount: Number(input.amount) || 0
            }));

            validRegisters.push({
                cashRegisterID: record.cashRegisterID,
                cashierName: record.cashierName,
                openedTime: record.openedTime,
                inputs: sanitizedInputs,
                cardPaymentAmount: Number(record.cardPaymentAmount) || 0,
                cashPaymentAmount: Number(record.cashPaymentAmount) || 0,
                bankTransferPaymentAmount: Number(record.bankTransferPaymentAmount) || 0,
                totalDiscountAmount: Number(record.totalDiscountAmount) || 0,
                totalProfitAmount: Number(record.totalProfitAmount) || 0,
                totalAmount: Number(record.totalAmount),
                grandTotal: Number(record.grandTotal),
                cashHandIn: Number(record.cashHandIn) || 0,
                cashVariance: Number(record.cashVariance) || 0,
                closedTime: closedTime,
            });
        }

        if (validRegisters.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid records to save',
                failedRecords
            });
        }

        const zReadingDoc = new ZReading({ registers: validRegisters });
        const savedDoc = await zReadingDoc.save();

        // Log formatted creation time for Z-reading
        const formattedCreationTime = formatToSriLankaTime(savedDoc.createdAt);
        console.log("✅ Z-Reading Saved Successfully:", {
            zReadingId: savedDoc._id,
            savedAt: formattedCreationTime.full,
            savedAtISO: formattedCreationTime.iso,
            registersCount: validRegisters.length,
            timezone: "Sri Lanka Time (UTC+05:30)"
        });

        const statusCode = failedRecords.length === 0 ? 201 : 207;

        return res.status(statusCode).json({
            success: true,
            savedCount: validRegisters.length,
            failedCount: failedRecords.length,
            savedDoc,
            failedRecords,
            message: failedRecords.length === 0
                ? 'All registers saved in one ZReading document. Zrecords cleared.'
                : 'Partial save: some records failed. Zrecords not cleared.'
        });

    } catch (error) {
        console.error('Z-reading save error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while saving Z-reading document',
            errorDetails: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

const getAllZReadingDetails = async (req, res) => {
    try {
        console.log("Received query parameters:", req.query);

        // Extract page and size from nested object
        const page = parseInt(req.query.page?.number, 10) || 1;
        const size = parseInt(req.query.page?.size, 10) || 10;

        console.log(`Parsed values -> Page: ${page}, Size: ${size}`);

        const offset = (page - 1) * size;

        // Fetch paginated data sorted by createdAt descending (latest first)
        const zReadingDetails = await ZReading.find()
            .sort({ _id: -1 }) // latest first
            .skip(offset)
            .limit(size)
            .lean(); // plain JS objects for modification

        const totalZReadings = await ZReading.countDocuments();

        console.log(`Total Records: ${totalZReadings}, Records Returned: ${zReadingDetails.length}`);

        if (!zReadingDetails.length) {
            return res.status(404).json({
                success: false,
                message: 'No Z-readings found'
            });
        }

        // Format openedTime and closedTime using timezone utility
        const formattedZReadings = zReadingDetails.map(z => {
            // Format the main createdAt date for the Z-reading document
            const formattedCreatedAtTime = formatToSriLankaTime(z.createdAt);
            z.formattedCreatedAt = formattedCreatedAtTime.dateOnly;
            z.formattedCreatedAtFull = {
                full: formattedCreatedAtTime.full,
                dateOnly: formattedCreatedAtTime.dateOnly,
                timeOnly: formattedCreatedAtTime.timeOnly,
                iso: formattedCreatedAtTime.iso
            };

            // Safety check: ensure registers array exists before mapping
            if (z.registers && Array.isArray(z.registers)) {
                z.registers = z.registers.map(r => {
                    // Format openedTime using timezone utility
                    if (r.openedTime) {
                        // Ensure openedTime is a valid Date object
                        let openedTimeDate = r.openedTime;
                        if (typeof r.openedTime === 'string') {
                            openedTimeDate = new Date(r.openedTime);
                        }
                        
                        const formattedOpenedTime = formatToSriLankaTime(openedTimeDate);
                        r.openedTime = formattedOpenedTime.full;
                        r.formattedOpenedTime = {
                            full: formattedOpenedTime.full,
                            dateOnly: formattedOpenedTime.dateOnly,
                            timeOnly: formattedOpenedTime.timeOnly,
                            iso: formattedOpenedTime.iso
                        };
                    }

                    // Format closedTime using timezone utility
                    if (r.closedTime) {
                        // Ensure closedTime is a valid Date object
                        let closedTimeDate = r.closedTime;
                        if (typeof r.closedTime === 'string') {
                            closedTimeDate = new Date(r.closedTime);
                        }
                        
                        const formattedClosedTime = formatToSriLankaTime(closedTimeDate);
                        r.closedTime = formattedClosedTime.full;
                        r.formattedClosedTime = {
                            full: formattedClosedTime.full,
                            dateOnly: formattedClosedTime.dateOnly,
                            timeOnly: formattedClosedTime.timeOnly,
                            iso: formattedClosedTime.iso
                        };
                    }

                    return r;
                });
            } else {
                // If registers doesn't exist or isn't an array, initialize as empty array
                console.warn(`Z-reading document ${z._id} has no registers array`);
                z.registers = [];
            }
            return z;
        });

        console.log(`📊 Z-Reading Details Fetched Successfully:`, {
            totalRecords: totalZReadings,
            recordsReturned: zReadingDetails.length,
            currentPage: page,
            totalPages: Math.ceil(totalZReadings / size),
            timezone: "Sri Lanka Time (UTC+05:30)"
        });

        res.status(200).json({
            success: true,
            data: formattedZReadings,
            currentPage: page,
            totalPages: Math.ceil(totalZReadings / size),
            totalItems: totalZReadings,
            message: 'Z-reading details retrieved successfully'
        });

    } catch (error) {
        console.error('Error retrieving Z-reading details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

const getAllZReadingByDate = async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "Date parameter is required"
            });
        }

        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);

        const query = {
            createdAt: {
                $gte: startDate,
                $lt: endDate
            }
        };

        let zReadingDetails = await ZReading.find(query);

        if (!zReadingDetails.length) {
            return res.status(404).json({
                success: false,
                message: 'No Z-readings found'
            });
        }

        // Convert openedTime and closedTime to Sri Lanka timezone format using utility
        zReadingDetails = zReadingDetails.map(zReading => {
            // Format the main createdAt date for the Z-reading document
            const formattedCreatedAtTime = formatToSriLankaTime(zReading.createdAt);
            
            const updatedRegisters = zReading.registers.map(register => {
                // Ensure openedTime is a valid Date object
                let openedTimeDate = register.openedTime;
                if (typeof register.openedTime === 'string') {
                    openedTimeDate = new Date(register.openedTime);
                }
                
                // Ensure closedTime is a valid Date object
                let closedTimeDate = register.closedTime;
                if (typeof register.closedTime === 'string') {
                    closedTimeDate = new Date(register.closedTime);
                }
                
                const formattedOpenedTime = formatToSriLankaTime(openedTimeDate);
                const formattedClosedTime = formatToSriLankaTime(closedTimeDate);

                return {
                    ...register._doc,
                    openedTime: formattedOpenedTime.full,
                    closedTime: formattedClosedTime.full,
                    formattedOpenedTime: {
                        full: formattedOpenedTime.full,
                        dateOnly: formattedOpenedTime.dateOnly,
                        timeOnly: formattedOpenedTime.timeOnly,
                        iso: formattedOpenedTime.iso
                    },
                    formattedClosedTime: {
                        full: formattedClosedTime.full,
                        dateOnly: formattedClosedTime.dateOnly,
                        timeOnly: formattedClosedTime.timeOnly,
                        iso: formattedClosedTime.iso
                    }
                };
            });

            return {
                ...zReading._doc,
                registers: updatedRegisters,
                formattedCreatedAt: formattedCreatedAtTime.dateOnly,
                formattedCreatedAtFull: {
                    full: formattedCreatedAtTime.full,
                    dateOnly: formattedCreatedAtTime.dateOnly,
                    timeOnly: formattedCreatedAtTime.timeOnly,
                    iso: formattedCreatedAtTime.iso
                }
            };
        });

        console.log(`📅 Z-Reading Details by Date Fetched Successfully:`, {
            requestedDate: date,
            recordsFound: zReadingDetails.length,
            timezone: "Sri Lanka Time (UTC+05:30)"
        });

        res.status(200).json({
            success: true,
            data: zReadingDetails,
            message: 'Z-reading details retrieved successfully'
        });

    } catch (error) {
        console.error('Error retrieving Z-reading details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

const deleteZReading = async (req, res) => {
    try {
        const { id } = req.params;
        const zReading = await ZReading.findByIdAndDelete(id);

        if (!zReading) {
            return res.status(404).json({
                success: false,
                message: 'Z-reading not found'
            });
        }
        res.status(200).json({ success: true, message: 'Z-reading deleted successfully' });
    } catch (error) {
        console.error('Error deleting Z-reading:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = { cashHandIn, saveZReading, getAllZReadingDetails, getAllZReadingByDate, deleteZReading, closeRegister, getAdminPasswordForDiscount, findProductByKeyword, generateReferenceNo, holdProducts, viewAllHeldProducts, deleteHeldProduct, getProductsByIds, updateProductQuantities, findProducts, findAllProductsForPos };

