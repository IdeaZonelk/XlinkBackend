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

const Sale = require("../../models/saleModel");
const SalePayment = require("../../models/salePaymentModel");
const Product = require("../../models/products/product");
const Settings = require("../../models/settingsModel");
const SaleReturn = require("../../models/saleReturnModel");
const Cash = require("../../models/posModel/cashModel");
const Customers = require("../../models/customerModel");
const mongoose = require("mongoose");
const { isEmpty } = require("lodash");
const Quatation = require("../../models/quatationModel");
const generateReferenceId = require("../../utils/generateReferenceID");
const io = require("../../server");
const Handlebars = require("handlebars");
const moment = require("moment-timezone");
const receiptSettingsSchema = require("../../models/receiptSettingsModel");
const {
  generateReceiptEighty,
  getBarcodeScriptEighty,
} = require("../../receiptTemplates/eighty_mm");
const {
  generateReceiptA5,
  getBarcodeScriptA5,
} = require("../../receiptTemplates/A5");
const {
  generateReceiptA4,
  getBarcodeScriptA4,
} = require("../../receiptTemplates/A4");

const formatDate = (date) => {
  if (!date) return "";
  // Convert UTC time to Sri Lankan time (Asia/Colombo timezone)
  const sriLankanTime = moment.utc(date).tz("Asia/Colombo");
  return sriLankanTime.format("MMM DD, YYYY HH:mm");
};

Handlebars.registerHelper("formatPaymentType", function (type) {
  const typeMap = {
    cash: "Cash",
    card: "Card",
    bank_transfer: "Bank Transfer",
  };
  return typeMap[type] || type;
});

Handlebars.registerHelper("formatCurrency", function (number) {
  if (isNaN(number)) return "0.00";
  const [integerPart, decimalPart] = parseFloat(number).toFixed(2).split(".");
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formattedInteger}.${decimalPart}`;
});

const createSale = async (req, res) => {
  try {
    const saleData = req.body;
    if (!saleData.invoiceNumber) {
      throw new Error("Invoice number is missing");
    }

    const receiptSettings = await receiptSettingsSchema.findOne();
    if (!receiptSettings) {
      throw new Error("Receipt settings not found");
    }

    saleData.claimedPoints = parseFloat(saleData.claimedPoints) || 0;
    saleData.redeemedPointsFromSale =
      parseFloat(saleData.redeemedPointsFromSale) || 0;

    const referenceId = await generateReferenceId("SALE");
    saleData.refferenceId = referenceId;
    saleData.invoiceNumber = saleData.invoiceNumber;
    saleData.date = new Date(); // POS sale uses server UTC time, not frontend time

    const settings = await Settings.findOne();
    if (!settings || !settings.defaultWarehouse) {
      throw new Error("Default warehouse is not configured in settings.");
    }
    const defaultWarehouse = settings.defaultWarehouse;

    if (isEmpty(saleData.warehouse) && isEmpty(saleData.warehouseId)) {
      throw new Error("Warehouse is required.");
    }
    if (isEmpty(saleData.refferenceId)) {
      throw new Error("Reference ID is required.");
    }
    // Note: Date validation removed for POS sales since we automatically set server time
    if (!saleData.productsData || saleData.productsData.length === 0) {
      throw new Error("Products Data is required.");
    }
    if (isEmpty(saleData.paymentStatus)) {
      throw new Error("Payment Status is required.");
    }

    // Set default values
    saleData.cashierUsername = saleData.cashierUsername || "Unknown";
    saleData.paymentType = saleData.paymentType || "cash";
    saleData.orderStatus = saleData.orderStatus || "ordered";
    saleData.customer = saleData.customer || "Unknown";
    saleData.warehouse = saleData.warehouse || saleData.warehouseId;

    if (!Array.isArray(saleData.paymentType)) {
      return res
        .status(400)
        .json({ message: "Invalid paymentType format.", status: "unsuccess" });
    }

    // Process payment types
    const paymentTypes = saleData.paymentType.map((payment) => {
      if (!payment.type || !payment.amount) {
        throw new Error(`Invalid payment type: ${JSON.stringify(payment)}`);
      }
      return { type: payment.type, amount: Number(payment.amount) };
    });
    saleData.paymentType = paymentTypes;

    // Warehouse validation
    if (saleData.warehouse !== defaultWarehouse) {
      return res.status(400).json({
        message:
          "Sale creation unsuccessful. Please choose products from the default warehouse to create a sale.",
        status: "unsuccess",
      });
    }

    // Cash register check
    const cashRegister = await Cash.findOne();
    if (!cashRegister) {
      return res.status(400).json({
        message: "Cash register not found. Sale creation failed.",
        status: "unsuccess",
      });
    }

    const newSale = new Sale(saleData);

    const productsData = saleData.productsData;

    // Prepare update promises for product quantities
    const updatePromises = productsData.map(async (product) => {
      const {
        currentID,
        quantity,
        ptype,
        warehouse,
        variationValue,
        batchNumber,
        isWeight,
      } = product;

      if (!mongoose.Types.ObjectId.isValid(currentID)) {
        throw new Error(`Invalid product ID: ${currentID}`);
      }
      if (!warehouse) {
        throw new Error(
          `Warehouse not provided for product with ID: ${currentID}`
        );
      }
      const updatedProduct = await Product.findById(currentID);
      if (!updatedProduct) {
        throw new Error(`Product not found with ID: ${currentID}`);
      }

      const warehouseData = updatedProduct.warehouse.get(warehouse);
      if (!warehouseData) {
        throw new Error(
          `Warehouse ${warehouse} not found for product with ID: ${currentID}`
        );
      }

      // Products with batches
      if (updatedProduct.hasBatches) {
        if (!batchNumber) {
          throw new Error(
            `Batch number is required for product with ID: ${currentID} (has batches)`
          );
        }

        const batch = warehouseData.batches.find(
          (b) => b.batchNumber === batchNumber
        );
        if (!batch) {
          throw new Error(
            `Batch ${batchNumber} not found in warehouse ${warehouse} for product with ID: ${currentID}`
          );
        }

        if (ptype === "Variation") {
          if (!variationValue) {
            throw new Error(
              `Variation value is required for product with ID: ${currentID} (has variations)`
            );
          }
          const variation = batch.variationValues?.get(variationValue);
          if (!variation) {
            throw new Error(
              `Variation ${variationValue} not found in batch ${batchNumber} for product with ID: ${currentID}`
            );
          }

          if (isWeight) {
            const currentWeight = Number(variation.totalProductWeight) || 0;
            const weightToDeduct = Number(quantity) || 0;

            if (currentWeight < weightToDeduct) {
              throw new Error(
                `Insufficient weight (${currentWeight} ${updatedProduct.unit}) for variation ${variationValue} in batch ${batchNumber} of product ${updatedProduct.name}. Requested: ${weightToDeduct} ${updatedProduct.unit}`
              );
            }

            variation.totalProductWeight = currentWeight - weightToDeduct;
          } else {
            if (variation.productQty < quantity) {
              throw new Error(
                `Insufficient quantity for variation ${variationValue} in batch ${batchNumber} of product ${updatedProduct.name}`
              );
            }
            variation.productQty -= quantity;
          }
        } else if (ptype === "Single") {
          if (isWeight) {
            const currentWeight = Number(batch.totalProductWeight) || 0;
            const weightToDeduct = Number(quantity) || 0;

            if (currentWeight < weightToDeduct) {
              throw new Error(
                `Insufficient weight (${currentWeight} ${updatedProduct.unit}) in batch ${batchNumber} of product ${updatedProduct.name}. Requested: ${weightToDeduct} ${updatedProduct.unit}`
              );
            }

            batch.totalProductWeight = currentWeight - weightToDeduct;
          } else {
            if (batch.productQty < quantity) {
              throw new Error(
                `Insufficient quantity in batch ${batchNumber} of product ${updatedProduct.name}`
              );
            }
            batch.productQty -= quantity;
          }
        } else {
          throw new Error(
            `Invalid product type for product with ID: ${currentID}`
          );
        }
      }
      // Products without batches
      else {
        if (ptype === "Variation") {
          if (!variationValue) {
            throw new Error(
              `Variation value is required for product with ID: ${currentID} (has variations)`
            );
          }

          const variation = warehouseData.variationValues?.get(variationValue);
          if (!variation) {
            throw new Error(
              `Variation ${variationValue} not found in warehouse ${warehouse} for product with ID: ${currentID}`
            );
          }

          if (isWeight) {
            const currentWeight = Number(variation.totalProductWeight) || 0;
            const weightToDeduct = Number(quantity) || 0;

            console.log("Variation weight check:", {
              productId: currentID,
              variation: variationValue,
              currentWeight,
              weightToDeduct,
              canProceed: currentWeight >= weightToDeduct,
            });

            if (currentWeight < weightToDeduct) {
              throw new Error(
                `Insufficient weight (${currentWeight} ${updatedProduct.unit}) for variation ${variationValue} of product ${updatedProduct.name}. Requested: ${weightToDeduct} ${updatedProduct.unit}`
              );
            }

            variation.totalProductWeight = currentWeight - weightToDeduct;
          } else {
            if (variation.productQty < quantity) {
              throw new Error(
                `Insufficient quantity for variation ${variationValue} of product ${updatedProduct.name}`
              );
            }
            variation.productQty -= quantity;
          }

          warehouseData.variationValues.set(variationValue, variation);
        } else if (ptype === "Single") {
          if (isWeight) {
            const currentWeight = Number(warehouseData.totalProductWeight) || 0;
            const weightToDeduct = Number(quantity) || 0;

            console.log("Single product weight check:", {
              productId: currentID,
              currentWeight,
              weightToDeduct,
              canProceed: currentWeight >= weightToDeduct,
            });

            if (currentWeight < weightToDeduct) {
              throw new Error(
                `Insufficient weight (${currentWeight} ${updatedProduct.unit}) of product ${updatedProduct.name}. Requested: ${weightToDeduct} ${updatedProduct.unit}`
              );
            }

            warehouseData.totalProductWeight = currentWeight - weightToDeduct;
          } else {
            if (warehouseData.productQty < quantity) {
              throw new Error(
                `Insufficient quantity of product ${updatedProduct.name} in warehouse ${warehouse}`
              );
            }
            warehouseData.productQty -= quantity;
          }
        } else {
          throw new Error(
            `Invalid product type for product with ID: ${currentID}`
          );
        }
      }

      // Save the updated product state
      updatedProduct.warehouse.set(warehouse, warehouseData);
      await updatedProduct.save();
      return updatedProduct;
    });

    // Apply product updates
    await Promise.all(updatePromises);
    // Save the sale
    await newSale.save();

    // If partial payment, insert payment records
    try {
      if (newSale.paymentStatus === "partial" && newSale.paidAmount > 0) {
        const paymentsToInsert = newSale.paymentType.map((payment) => ({
          saleId: newSale._id,
          amountToPay: newSale.grandTotal,
          payingAmount: payment.amount,
          currentDate: newSale.date || new Date(),
          paymentType: payment.type,
        }));
        await SalePayment.insertMany(paymentsToInsert);
      }
    } catch (paymentErr) {
      console.error("Error creating initial payment record:", paymentErr);
    }

    // Update customer loyalty points (if applicable)
    try {
      const claimedPoints = saleData.claimedPoints || 0;
      const redeemedPointsFromSale = saleData.redeemedPointsFromSale || 0;

      // Calculate 1% loyalty points from sale total
      const saleTotal = saleData.grandTotal || 0;

      // Update customer points if there are any point transactions or if customer exists for earning points
     if (
    claimedPoints > 0 ||
    redeemedPointsFromSale > 0 ||
    (saleData.customer && saleData.customer !== "Unknown")
) {
        if (saleData.customer && saleData.customer !== "Unknown") {
          let customer;

          // Find by ID if valid ObjectId, otherwise by name
          if (mongoose.Types.ObjectId.isValid(saleData.customer)) {
            customer = await Customers.findById(saleData.customer);
          }
          if (!customer) {
            customer = await Customers.findOne({ name: saleData.customer });
          }

          if (customer) {
            if (!customer.loyalty) {
              customer.loyalty = {
                loyaltyReferenceNumber: `CUST-${customer._id
                  .toString()
                  .slice(-6)}`,
                redeemedPoints: 0,
              };
            }

            const currentRedeemedPoints =
              parseFloat(customer.loyalty.redeemedPoints) || 0;

            if (claimedPoints > currentRedeemedPoints) {
              console.warn(
                `Claimed points (${claimedPoints}) exceed available points (${currentRedeemedPoints}) for customer ${customer.name}`
              );
            }

            // Calculate new points: current points - claimed points + redeemed points
            // Note: redeemedPointsFromSale already contains the calculated loyalty points from frontend
            const newRedeemedPoints =
              Math.max(0, currentRedeemedPoints - claimedPoints) +
              redeemedPointsFromSale;

            customer.loyalty.redeemedPoints = newRedeemedPoints;
            await customer.save();

            console.log(
              `Updated customer ${customer.name} points: ${currentRedeemedPoints} -> ${newRedeemedPoints} (Claimed: ${claimedPoints}, Redeemed from Sale: ${redeemedPointsFromSale})`
            );
          } else {
            console.warn(
              `Customer ${saleData.customer} not found for points update`
            );
          }
        }
      }
    } catch (pointsError) {
      console.error("Error updating customer loyalty points:", pointsError);
    }

    // Update cash register
    const { paidAmount } = saleData;
    try {
      cashRegister.totalBalance += parseFloat(paidAmount || 0);
      await cashRegister.save();
    } catch (cashErr) {
      console.error("Error updating cash register:", cashErr);
    }

    // Generate receipt HTML
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const logoUrl = settings.logo
      ? `${baseUrl}/${settings.logo.replace(/\\/g, "/")}`
      : null;

    const formatDate = (date) => {
      if (!date) return "";
      // Convert UTC time to Sri Lankan time (Asia/Colombo timezone)
      const sriLankanTime = moment.utc(date).tz("Asia/Colombo");
      return sriLankanTime.format("MMM DD, YYYY HH:mm");
    };

    const totalSavedAmount = saleData.productsData.reduce((sum, product) => {
      const saved =
        product.price && product.ourPrice && product.price > product.ourPrice
          ? (product.price - product.ourPrice) * product.quantity
          : 0;
      return sum + saved + (product.specialDiscount || 0);
    }, 0);

    // Use redeemedPointsFromSale directly for display (already calculated on frontend)
    const displayRedeemedPoints = saleData.redeemedPointsFromSale || 0;

    console.log("POS Sale Loyalty Points Debug:", {
      claimedPoints: saleData.claimedPoints || 0,
      redeemedPointsFromSale: saleData.redeemedPointsFromSale || 0,
      displayRedeemedPoints: displayRedeemedPoints,
      customer: saleData.customer,
      grandTotal: saleData.grandTotal,
    });

  const templateData = {
            settings: {
                companyName: settings.companyName || '',
                companyAddress: receiptSettings.address ? (settings.address || 'Address: XXX-XXX-XXXX') : '',
                companyMobile: receiptSettings.phone ? (settings.companyMobile || 'Phone: XXX-XXX-XXXX') : '',
                logo: receiptSettings.logo ? logoUrl : null,
            },
            newSale: {
                cashierUsername: newSale.cashierUsername || '',
                invoiceNumber: newSale.invoiceNumber || '',
                date: formatDate(newSale.date),
                customer: newSale.customerName || newSale.customer || 'Unknown',
                customerName: newSale.customerName || 'Unknown',
                productsData: saleData.productsData.map(product => ({
                    name: product.name || 'Unnamed Product',
                    price: product.applicablePrice || 0,
                    appliedWholesale: product.appliedWholesale || false,
                    quantity: product.quantity || 0,
                    subtotal: product.subtotal || 0,
                    specialDiscount: product.specialDiscount || 0,
                    discount: product.discount || 0,
                    taxRate: product.taxRate || 0,
                    taxType: product.taxType || 'exclusive',
                })),
                baseTotal: newSale.baseTotal || 0,
                grandTotal: newSale.grandTotal || 0,
                totalPcs: newSale.totalPcs || 0,
                discount: newSale.discountValue || 0,
                cashBalance: newSale.cashBalance || 0,
                paymentStatus: newSale.paymentStatus || saleData.paymentStatus || '',
                paymentType: saleData.paymentType.map(payment => ({
                    type: payment.type || 'Unknown',
                    amount: payment.amount || 0,
                })),
                note: receiptSettings.note ? (newSale.note || '') : '',
                totalSavedAmount: receiptSettings.taxDiscountShipping ?
                    (totalSavedAmount + newSale.discountValue + newSale.offerValue - newSale.taxValue || 0) :
                    undefined,
                barcode: receiptSettings.barcode ? newSale.invoiceNumber : undefined,
        claimedPoints: saleData.claimedPoints || 0,
        redeemedPointsFromSale: saleData.redeemedPointsFromSale || 0,
            },
        };

    console.log(
      "POS Sale Template Data Debug:",
      JSON.stringify(
        {
          claimedPoints: templateData.newSale.claimedPoints,
          redeemedPointsFromSale: templateData.newSale.redeemedPointsFromSale,
          customer: saleData.customer,
          template: newSale.receiptSize || receiptSettings.template,
        },
        null,
        2
      )
    );

    let html = "";
    let barcodeScript = "";

    switch (newSale.receiptSize || receiptSettings.template) {
      case "80mm":
        html = generateReceiptEighty(templateData);
        barcodeScript = getBarcodeScriptEighty();
        break;
      case "A5":
        html = generateReceiptA5(templateData);
        barcodeScript = getBarcodeScriptA5();
        break;
      case "A4":
        html = generateReceiptA4(templateData);
        barcodeScript = getBarcodeScriptA4();
        break;
      default:
        throw new Error(
          `Unknown receipt template: ${receiptSettings.template}`
        );
    }
    const fullHtml = barcodeScript + html;

    console.log("POS Sale Generated HTML contains loyalty points:", {
      hasClaimedPoints: fullHtml.includes("Claimed Points"),
      hasRedeemedPoints: fullHtml.includes("Redeemed Points"),
      templateUsed: newSale.receiptSize || receiptSettings.template,
      htmlLength: fullHtml.length,
    });

    res.status(201).json({
      message: "Sale created successfully!",
      html: fullHtml,
      status: "success",
      sale: newSale,
    });
  } catch (error) {
    console.error("Error saving sale:", error);
    res.status(500).json({
      message: error.message,
      status: "unsuccess",
      error: error.stack,
    });
  }
};

const createNonPosSale = async (req, res) => {
  try {
    const saleData = req.body;

    // Generate invoice number if not provided
    if (!saleData.invoiceNumber) {
      // Generate a simple invoice number based on timestamp and random number
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      saleData.invoiceNumber = `INV-${timestamp}-${random}`;
    }

    saleData.claimedPoints = parseFloat(saleData.claimedPoints) || 0;
    saleData.redeemedPointsFromSale =
      parseFloat(saleData.redeemedPointsFromSale) || 0;

    // Fetch receipt settings for receipt generation
    const receiptSettings = await receiptSettingsSchema.findOne();
    if (!receiptSettings) {
      throw new Error("Receipt settings not found");
    }

    // Fetch settings for receipt generation
    const settings = await Settings.findOne();
    if (!settings) {
      throw new Error("Settings not found");
    }

    const referenceId = await generateReferenceId("SALE");
    saleData.refferenceId = referenceId;

    // Validation checks using isEmpty
    if (isEmpty(saleData.warehouse) && isEmpty(saleData.warehouseId)) {
      return res
        .status(400)
        .json({ message: "Warehouse is required.", status: "unsuccess" });
    }
    if (isEmpty(saleData.refferenceId)) {
      return res
        .status(400)
        .json({ message: "Reference ID is required.", status: "unsuccess" });
    }
    
    // Set server-side UTC time for nonPos sales (same as POS sales)
    saleData.date = new Date();
    
    if (!saleData.productsData || saleData.productsData.length === 0) {
      return res
        .status(400)
        .json({ message: "Products Data is required.", status: "unsuccess" });
    }

    if (isEmpty(saleData.warehouse) && isEmpty(saleData.warehouses)) {
      return res
        .status(400)
        .json({ message: "Warehouse is required.", status: "unsuccess" });
    }

    // Default values for optional fields
    saleData.cashierUsername = saleData.cashierUsername || "Unknown";
    saleData.warehouse = saleData.warehouse || saleData.warehouseId;

    if (!Array.isArray(saleData.paymentType)) {
      return res
        .status(400)
        .json({ message: "Invalid paymentType format.", status: "unsuccess" });
    }

    const paymentTypes = saleData.paymentType.map((payment) => {
      if (!payment.type || !payment.amount) {
        throw new Error(`Invalid payment type: ${JSON.stringify(payment)}`);
      }
      return { type: payment.type, amount: Number(payment.amount) };
    });

    saleData.paymentType = paymentTypes;

    const newSale = new Sale(saleData);


    const productsData = saleData.productsData;

    // Prepare update promises for product quantities
    const updatePromises = productsData.map(async (product) => {
      const { currentID, quantity, stockQty, ptype, warehouse } = product;

      if (!mongoose.Types.ObjectId.isValid(currentID)) {
        return Promise.reject({
          message: `Invalid product ID: ${currentID}`,
          status: "unsuccess",
        });
      }

      if (!warehouse) {
        return Promise.reject({
          message: `Warehouse not provided for product with ID: ${currentID}`,
          status: "unsuccess",
        });
      }

      const updatedProduct = await Product.findById(currentID);
      if (!updatedProduct) {
        return Promise.reject({
          message: `Product not found with ID: ${currentID}`,
          status: "unsuccess",
        });
      }

      const warehouseData = updatedProduct.warehouse.get(warehouse);
      if (!warehouseData) {
        console.error(
          `Error: Warehouse ${warehouse} not found for product ID: ${currentID}`
        );
        return Promise.reject({
          message: `Warehouse with ID ${warehouse} not found for product with ID: ${currentID}`,
          status: "unsuccess",
        });
      }

      if (ptype === "Single") {
        console.log(
          `Debug: Current stock for product ${currentID} in warehouse ${warehouse}:`,
          warehouseData.productQty
        );

        if (warehouseData.productQty < quantity) {
          console.error(
            `Error: Insufficient stock for product ${currentID} (Available: ${warehouseData.productQty}, Required: ${quantity})`
          );
          return Promise.reject({
            message: `Insufficient stock for product with ID: ${currentID}`,
            status: "unsuccess",
          });
        }

        warehouseData.productQty -= quantity;
      } else if (ptype === "Variation") {
        const variationKey = product.variationValue;
        const variation = warehouseData.variationValues?.get(variationKey);

        if (!variation) {
          return Promise.reject({
            message: `Variation ${variationKey} not found for product with ID: ${currentID}`,
            status: "unsuccess",
          });
        }

        if (variation.productQty < quantity) {
          return Promise.reject({
            message: `Insufficient stock for variation ${variationKey} of product with ID: ${currentID}`,
            status: "unsuccess",
          });
        }

        variation.productQty -= quantity;
      } else {
        return Promise.reject({
          message: `Invalid product type for product with ID: ${currentID}`,
          status: "unsuccess",
        });
      }

      updatedProduct.warehouse.set(warehouse, warehouseData);
      await updatedProduct.save({ validateModifiedOnly: true });
      return updatedProduct;
    });

    await Promise.all(updatePromises);
    await newSale.save();

    /** Loyalty points update **/
   // Update customer loyalty points (if applicable)
try {
    const claimedPoints = saleData.claimedPoints || 0;
    const redeemedPointsFromSale = saleData.redeemedPointsFromSale || 0;

    // Update customer points if there are any point transactions or if customer exists for earning points
    if (
        claimedPoints > 0 ||
        redeemedPointsFromSale > 0 ||
        (saleData.customer && saleData.customer !== "Unknown")
    ) {
        let customer;
        
        // Find customer by ID or name
        if (mongoose.Types.ObjectId.isValid(saleData.customer)) {
            customer = await Customers.findById(saleData.customer);
        } else {
            customer = await Customers.findOne({ name: saleData.customer });
        }

        if (customer) {
            if (!customer.loyalty) {
                customer.loyalty = {
                    loyaltyReferenceNumber: `CUST-${customer._id.toString().slice(-6)}`,
                    redeemedPoints: 0,
                };
            }

            const currentRedeemedPoints = parseFloat(customer.loyalty.redeemedPoints) || 0;

            if (claimedPoints > currentRedeemedPoints) {
                console.warn(
                    `Claimed points (${claimedPoints}) exceed available points (${currentRedeemedPoints}) for customer ${customer.name}`
                );
            }

            // Calculate new points: current points - claimed points + redeemed points
            const newRedeemedPoints = Math.max(0, currentRedeemedPoints - claimedPoints) + redeemedPointsFromSale;

            customer.loyalty.redeemedPoints = newRedeemedPoints;
            await customer.save();

            console.log(
                `Updated customer ${customer.name} points: ${currentRedeemedPoints} -> ${newRedeemedPoints} (Claimed: ${claimedPoints}, Redeemed from Sale: ${redeemedPointsFromSale})`
            );
        } else {
            console.warn(
                `Customer ${saleData.customer} not found for points update`
            );
        }
    }
} catch (pointsError) {
    console.error("Error updating customer loyalty points:", pointsError);
}
    /** Payment records update **/
    try {
      if (newSale.paymentStatus === "partial" && newSale.paidAmount > 0) {
        const paymentsToInsert = newSale.paymentType.map((payment) => ({
          saleId: newSale._id,
          amountToPay: newSale.grandTotal,
          payingAmount: payment.amount,
          currentDate: newSale.date || new Date(),
          paymentType: payment.type,
        }));
        await SalePayment.insertMany(paymentsToInsert);
      }
    } catch (paymentErr) {
      console.error("Error creating initial payment record:", paymentErr);
    }

    // Generate receipt HTML
    let html, barcodeScript;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const logoUrl = settings.logo
      ? `${baseUrl}/${settings.logo.replace(/\\/g, "/")}`
      : null;

    // Date formatting helper
    const formatDate = (date) => {
      if (!date) return "";
      // Convert UTC time to Sri Lankan time (Asia/Colombo timezone)
      const sriLankanTime = moment.utc(date).tz("Asia/Colombo");
      return sriLankanTime.format("MMM DD, YYYY HH:mm");
    };

    const totalSavedAmount = saleData.productsData.reduce((sum, product) => {
      const saved =
        product.price && product.ourPrice && product.price > product.ourPrice
          ? (product.price - product.ourPrice) * product.quantity
          : 0;
      return sum + saved + product.specialDiscount;
    }, 0);

    // Use redeemedPointsFromSale directly for display (already calculated on frontend)
    const displayRedeemedPoints = saleData.redeemedPointsFromSale || 0;

    console.log("Non-POS Sale Loyalty Points Debug:", {
      claimedPoints: saleData.claimedPoints || 0,
      redeemedPointsFromSale: saleData.redeemedPointsFromSale || 0,
      displayRedeemedPoints: displayRedeemedPoints,
      customer: saleData.customer,
    });

    const templateData = {
      settings: {
        companyName: settings.companyName || "",
        companyAddress: receiptSettings.address
          ? settings.address || "Address: XXX-XXX-XXXX"
          : "",
        companyMobile: receiptSettings.phone
          ? settings.companyMobile || "Phone: XXX-XXX-XXXX"
          : "",
        logo: receiptSettings.logo ? logoUrl : null,
      },
      isNonPosSale: true, // Flag to identify non-POS sales
      newSale: {
        cashierUsername: newSale.cashierUsername || "",
        invoiceNumber: newSale.invoiceNumber || "",
        date: formatDate(newSale.date),
        customer: receiptSettings.customer ? newSale.customer || "" : "",
        productsData: saleData.productsData.map((product) => ({
          name: product.name || "Unnamed Product",
          price: product.applicablePrice || 0,
          appliedWholesale: product.appliedWholesale || false,
          quantity: product.quantity || 0,
          subtotal: product.subtotal || 0,
          specialDiscount: product.specialDiscount || 0,
          discount: product.discount || 0,
          taxRate: product.taxRate || 0,
        })),
        baseTotal: newSale.baseTotal || 0,
        grandTotal: newSale.grandTotal || 0,
        totalPcs: newSale.totalPcs || 0,
        discount: newSale.discountValue || 0,
        cashBalance: newSale.cashBalance || 0,
        paymentStatus: newSale.paymentStatus || saleData.paymentStatus || "",
        paymentType: saleData.paymentType.map((payment) => ({
          type: payment.type || "Unknown",
          amount: payment.amount || 0,
        })),
        note: receiptSettings.note
          ? newSale.note &&
            newSale.note !== "null" &&
            newSale.note.trim() !== ""
            ? newSale.note
            : ""
          : "",
        totalSavedAmount: receiptSettings.taxDiscountShipping
          ? totalSavedAmount +
              newSale.discountValue +
              newSale.offerValue -
              newSale.taxValue || 0
          : undefined,
        barcode: receiptSettings.barcode ? newSale.invoiceNumber : undefined,
        claimedPoints: saleData.claimedPoints || 0,
        redeemedPointsFromSale: displayRedeemedPoints,
      },
    };

    console.log(
      "Non-POS Sale Template Data Debug:",
      JSON.stringify(
        {
          claimedPoints: templateData.newSale.claimedPoints,
          redeemedPointsFromSale: templateData.newSale.redeemedPointsFromSale,
          isNonPosSale: templateData.isNonPosSale,
          template: newSale.receiptSize || receiptSettings.template,
        },
        null,
        2
      )
    );

    switch (newSale.receiptSize || receiptSettings.template) {
      case "80mm":
        html = generateReceiptEighty(templateData);
        barcodeScript = getBarcodeScriptEighty();
        break;
      case "A5":
        html = generateReceiptA5(templateData);
        barcodeScript = getBarcodeScriptA5();
        break;
      case "A4":
        html = generateReceiptA4(templateData);
        barcodeScript = getBarcodeScriptA4();
        break;
      default:
        throw new Error(
          `Unknown receipt template: ${receiptSettings.template}`
        );
    }
    const fullHtml = barcodeScript + html;

    console.log("Generated HTML contains loyalty points:", {
      hasClaimedPoints: fullHtml.includes("Claimed Points"),
      hasRedeemedPoints: fullHtml.includes("Redeemed Points"),
      templateUsed: newSale.receiptSize || receiptSettings.template,
      claimedPointsValue:
        fullHtml.match(/Claimed Points:.*?<\/td>/s)?.[0] || "Not found",
      redeemedPointsValue:
        fullHtml.match(/Redeemed Points From Sale:.*?<\/td>/s)?.[0] ||
        "Not found",
    });

    res.status(201).json({
      message: "Non-POS Sale created successfully!",
      html: fullHtml,
      status: "success",
      sale: newSale,
    });
  } catch (error) {
    console.error("Error saving Non-POS sale:", error);
    res.status(500).json({
      message: "Error saving Non-POS sale",
      error: error.message,
      status: "unsuccess",
    });
  }
};

// Delete a sale
const deleteSale = async (req, res) => {
  const { id } = req.params; // Get the sale ID from the request parameters
  if (!id) {
    return res.status(400).json({ message: "ID is required" });
  }
  try {
    const deletedSale = await Sale.findByIdAndDelete(id); // Delete the sale by ID
    if (!deletedSale) {
      return res.status(404).json({ message: "Sale not found" }); // If no sale is found, send 404
    }
    res
      .status(200)
      .json({ message: "Sale deleted successfully!", sale: deletedSale }); // Send success response
  } catch (error) {
    console.error("Error deleting sale:", error);
    res.status(500).json({ message: "Error deleting sale", error });
  }
};

const payingForSale = async (req, res) => {
  const { saleId, amountToPay, payingAmount, paymentType, currentDate } =
    req.body;

  try {
    // Find the sale by ID
    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    // Ensure amount values are numbers
    if (
      typeof sale.grandTotal !== "number" ||
      typeof sale.paidAmount !== "number"
    ) {
      return res.status(400).json({ message: "Invalid sale amount data" });
    }

    // Convert values to numbers
    const numericPayingAmount = Number(payingAmount);
    const numericAmountToPay = Number(amountToPay);

    // Ensure payment doesn't exceed the total amount
    const newTotalPaidAmount = sale.paidAmount + numericPayingAmount;
    if (newTotalPaidAmount > numericAmountToPay) {
      return res
        .status(400)
        .json({ message: "Payment exceeds the amount to pay." });
    }

    // Create a new payment entry
    const newPayment = new SalePayment({
      saleId,
      amountToPay: numericAmountToPay,
      payingAmount: numericPayingAmount,
      currentDate: currentDate || Date.now(),
      paymentType: paymentType || "Default",
    });

    await newPayment.save();
    const existingPaymentIndex = sale.paymentType.findIndex(
      (pt) => pt.type === paymentType
    );

    if (existingPaymentIndex !== -1) {
      sale.paymentType[existingPaymentIndex].amount += numericPayingAmount;
    } else {
      sale.paymentType.push({ type: paymentType, amount: numericPayingAmount });
    }

    sale.paidAmount = newTotalPaidAmount;
    const allPayments = await SalePayment.find({ saleId });
    const totalPaidAmount = allPayments.reduce(
      (sum, payment) => sum + payment.payingAmount,
      0
    );

    const dueAmount = numericAmountToPay - totalPaidAmount;

    if (totalPaidAmount === 0) {
      sale.paymentStatus = "unpaid";
    } else if (totalPaidAmount >= sale.grandTotal) {
      sale.paymentStatus = "paid";
    } else if (totalPaidAmount > 0 && totalPaidAmount < sale.grandTotal) {
      sale.paymentStatus = "partial";
    }

    await sale.save();

    return res.status(201).json({
      message: "Payment recorded successfully",
      payment: newPayment,
      sale: {
        saleId: sale._id,
        paidAmount: totalPaidAmount,
        dueAmount: dueAmount,
        paymentStatus: sale.paymentStatus,
        paymentDetails: sale.paymentType,
      },
    });
  } catch (error) {
    console.error("Error recording payment:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the payment" });
  }
};

const deletePaymentOfSale = async (req, res) => {
  const { id } = req.params; // Payment ID
  try {
    // Find the payment to delete
    const payment = await SalePayment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const saleId = payment.saleId;

    // Find the associated sale
    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    // Subtract the payment amount from the sale's paidAmount
    sale.paidAmount -= payment.payingAmount;

    // Ensure paidAmount doesn't fall below 0
    if (sale.paidAmount < 0) {
      sale.paidAmount = 0;
    }

    // Recalculate the payment status
    if (sale.paidAmount === 0) {
      sale.paymentStatus = "Unpaid";
    } else if (sale.paidAmount >= sale.grandTotal) {
      sale.paymentStatus = "Paid";
    } else {
      sale.paymentStatus = "Partial";
    }

    // Save the updated sale
    await sale.save();

    // Delete the payment
    await SalePayment.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Payment deleted successfully",
      sale: {
        saleId: sale._id,
        paidAmount: sale.paidAmount,
        paymentStatus: sale.paymentStatus,
      },
    });
  } catch (error) {
    console.error("Error deleting payment:", error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the payment" });
  }
};

// Controller to fetch payment by sale Id
const fetchPaymentBySaleId = async (req, res) => {
  const { saleId } = req.params;
  try {
    const paymentData = await SalePayment.find({ saleId: saleId });
    if (!paymentData || paymentData.length === 0) {
      return res
        .status(404)
        .json({ message: "No payments found for this sale ID" });
    }
    res.status(200).json({ payments: paymentData });
  } catch (error) {
    console.error("Error fetching payment data:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching payment data" });
  }
};

const findSaleById = async (req, res) => {
  const { id } = req.params;
  console.log("🔍 Received request to fetch sale by ID:", id);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid sale ID format" });
  }

  try {
    const sale = await Sale.findById(id).lean(); // Using lean() to get a plain object
    console.log(
      "📦 Full Sale Data Fetched from DB:",
      JSON.stringify(sale, null, 2)
    );
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const productIds = sale.productsData.map((product) => product.currentID);
    console.log("🆔 Extracted Product IDs:", productIds);

    const products = await Product.find({ _id: { $in: productIds } }).lean(); // Using lean() to get plain objects
    console.log(
      "📦 Full Product Data Fetched from DB:",
      JSON.stringify(products, null, 2)
    );

    const updatedProductsData = sale.productsData.map((productData) => {
      const baseProduct = products.find(
        (p) => p._id.toString() === productData.currentID
      );
      const warehouseKey = productData.warehouse;
      if (baseProduct) {
        console.log(
          `Base product found for ID ${productData.currentID}:`,
          JSON.stringify(baseProduct, null, 2)
        );
        let stockQty = "";
        let productCost = "";

        const selectedWarehouse = baseProduct.warehouse[warehouseKey];
        console.log(
          `Warehouse data for product ${baseProduct._id}:`,
          JSON.stringify(selectedWarehouse, null, 2)
        );

        if (!selectedWarehouse) {
          console.error(
            `Warehouse ${warehouseKey} not found for product with ID: ${baseProduct._id}`
          );
          return {
            ...productData,
            stockQty: "N/A",
            productCost,
          };
        }

        if (productData.variationValue && selectedWarehouse.variationValues) {
          const variation =
            selectedWarehouse.variationValues[productData.variationValue];
          if (variation) {
            stockQty = variation.productQty || "";
            productCost = variation.productCost || "";
          } else {
            console.error(
              `Variation ${productData.variationValue} not found for product with ID: ${baseProduct._id}`
            );
          }
        } else {
          stockQty = selectedWarehouse.productQty || "";
          productCost = selectedWarehouse.productCost || "";
        }

        console.log(
          `Calculated stockQty for product ${productData.currentID}: ${stockQty}`
        );
        return {
          currentID: productData.currentID,
          variationValues: selectedWarehouse.variationValues,
          selectedVariation: productData.variationValue,
          name: productData.name,
          price: productData.price,
          productCost,
          ptype: productData.ptype,
          discount: productData.discount,
          specialDiscount: productData.specialDiscount,
          quantity: productData.quantity,
          stockQty,
          taxRate: productData.taxRate,
          taxType: productData.taxType,
          subtotal: productData.subtotal,
          warehouse: productData.warehouse,
          wholesaleEnabled: productData.wholesaleEnabled,
          wholesaleMinQty: productData.wholesaleMinQty,
          wholesalePrice: productData.wholesalePrice,
          _id: productData._id,
        };
      }

      console.warn(
        `Base product with currentID ${productData.currentID} not found.`
      );
      // Return original product data if no base product found
      return productData;
    });

    const saleWithUpdatedProducts = {
      ...sale,
      productsData: updatedProductsData,
    };

    console.log(
      "🚀 Final Sale Data Sent to Frontend:",
      JSON.stringify(saleWithUpdatedProducts, null, 2)
    );
    res.status(200).json(saleWithUpdatedProducts);
  } catch (error) {
    console.error("❌ Error finding sale by ID:", error);
    res
      .status(500)
      .json({ message: "Error fetching sale by ID", error: error.message });
  }
};

const updateSale = async (req, res) => {
  try {
    const saleId = req.params.id;
    const updateData = req.body;

    console.log(
      "\uD83D\uDEE0\uFE0F Received request to update sale ID:",
      saleId
    );
    console.log(
      "\uD83D\uDCE5 Update Data:",
      JSON.stringify(updateData, null, 2)
    );

    if (
      !updateData.date ||
      !updateData.paymentStatus ||
      !updateData.orderStatus ||
      !updateData.paymentType
    ) {
      return res
        .status(400)
        .json({ message: "Missing required fields.", status: "unsuccess" });
    }

    updateData.cashierUsername = updateData.cashierUsername || "Unknown";
    updateData.paymentType = updateData.paymentType || [];
    updateData.orderStatus = updateData.orderStatus || "ordered";
    updateData.customer = updateData.customer || "Unknown";

    console.log("\uD83D\uDD0D Fetching existing sale from DB...");
    const existingSale = await Sale.findById(saleId);
    if (!existingSale) {
      console.error("❌ Sale not found:", saleId);
      return res
        .status(404)
        .json({ message: "Sale not found", status: "unsuccess" });
    }

    console.log(
      "\uD83D\uDCE6 Existing Sale Data:",
      JSON.stringify(existingSale, null, 2)
    );

    const existingProducts = existingSale.productsData;
    const updatedProducts = updateData.productsData;

    console.log("\uD83D\uDD04 Processing updated products...");
    let errors = [];

    await Promise.all(
      updatedProducts.map(async (product) => {
        try {
          const {
            currentID,
            quantity: newQuantity,
            ptype,
            variationValue,
          } = product;
          const warehouse = product.warehouse || updateData.warehouse;

          console.log(
            "🔖 Processing Product:",
            currentID,
            "| Warehouse:",
            warehouse
          );

          const updatedProduct = await Product.findById(currentID);
          if (!updatedProduct) {
            errors.push(`Product not found with ID: ${currentID}`);
            return;
          }

          console.log("🏪 Fetching warehouse data...");
          const warehouseData = updatedProduct.warehouse.get(warehouse);

          if (!warehouseData) {
            console.warn(`⚠️ Warehouse ${warehouse} not found.`);
            return;
          }

          console.log("📊 Adjusting stock quantity...");
          const existingProduct = existingProducts.find(
            (p) => p.currentID === currentID
          );
          const previousQuantity = existingProduct
            ? existingProduct.quantity
            : 0;
          const quantityDifference = newQuantity - previousQuantity;

          // FIXED: Changed from existingPurchase.warehouse to existingSale.warehouse
          const warehouseKey =
            existingProduct?.warehouse || existingSale.warehouse;

          if (ptype === "Single") {
            const selectedWarehouse =
              updatedProduct.warehouse.get(warehouseKey);
            if (!selectedWarehouse) {
              throw new Error(
                `Warehouse ${warehouseKey} not found for product with ID: ${currentID}`
              );
            }
            if (
              quantityDifference < 0 &&
              selectedWarehouse.productQty < Math.abs(quantityDifference)
            ) {
              throw new Error(
                `Insufficient stock for product ID: ${currentID}`
              );
            }
            selectedWarehouse.productQty -= quantityDifference;
          } else if (ptype === 'Variation') {
                    const selectedWarehouse = updatedProduct.warehouse.get(warehouseKey);
                    if (!selectedWarehouse) {
                        throw new Error(`Warehouse ${warehouseKey} not found for product with ID: ${currentID}`);
                    }
                  const productVariations = updatedProducts.filter(
                        p => p.currentID === currentID && p.ptype === 'Variation'
                    );

                    productVariations.forEach(variationProduct => {
                        const variationKey = variationProduct.variationValue;
                        const newQty = variationProduct.quantity;
                        const existingVarProduct = existingProducts.find(
                            ep => ep.currentID === currentID && ep.variationValue === variationKey
                        );
                        const prevQty = existingVarProduct ? existingVarProduct.quantity : 0;
                        const qtyDiff = newQty - prevQty;

                        const variation = selectedWarehouse.variationValues.get(variationKey);
                        if (!variation) {
                            errors.push(`Variation ${variationKey} not found for product ID: ${currentID}`);
                            return;
                        }
                        if (qtyDiff < 0 && variation.productQty < Math.abs(qtyDiff)) {
                            errors.push(`Insufficient variation stock for product ID: ${currentID}, variation: ${variationKey}`);
                            return;
                        }
                        variation.productQty -= qtyDiff;
                        updatedProduct.markModified(`warehouse.${warehouseKey}.variationValues`);
                    });
                } else {
                    errors.push(`Invalid product type for product with ID: ${currentID}`);
                    return;
                }


          // Ensure warehouse update is saved
          updatedProduct.warehouse.set(warehouse, warehouseData);
          updatedProduct.markModified("warehouse");
          await updatedProduct.save();

          console.log(
            `✅ Stock updated in DB for ${currentID}:`,
            warehouseData.productQty
          );
        } catch (err) {
          console.error(
            `❌ Error processing product ${product.currentID}:`,
            err
          );
          errors.push(
            `Error processing product ${product.currentID}: ${err.message}`
          );
        }
      })
    );

    if (errors.length > 0) {
      return res
        .status(400)
        .json({ message: "Error updating products", details: errors });
    }

    console.log("✅ All product updates completed successfully.");

    updateData.productsData = updateData.productsData.map((product) => ({
      ...product,
      warehouse:
        product.warehouse || updateData.warehouse || "default_warehouse",
    }));

    // Update customer loyalty points (if applicable)
// Update customer loyalty points (if applicable)
try {
    const claimedPoints = updateData.claimedPoints || 0;
    const redeemedPointsFromSale = updateData.redeemedPointsFromSale || 0;

    // Get the previous redeemed points from the existing sale
    const previousRedeemedPoints = existingSale.redeemedPointsFromSale || 0;
    
    // Calculate the difference in points
    const pointsDifference = redeemedPointsFromSale - previousRedeemedPoints;

    console.log("Loyalty Points Update:", {
        previousRedeemedPoints,
        newRedeemedPoints: redeemedPointsFromSale,
        pointsDifference,
        customer: existingSale.customer
    });

    // Only update customer points if there's a difference and customer exists
        if ((pointsDifference !== 0 || claimedPoints > 0) && 
        existingSale.customer && existingSale.customer !== "Unknown") {
        
        let customer;
        
        // Find customer by ID or name
        if (mongoose.Types.ObjectId.isValid(existingSale.customer)) {
            customer = await Customers.findById(existingSale.customer);
        } else {
            customer = await Customers.findOne({ name: existingSale.customer });
        }

        if (customer) {
            if (!customer.loyalty) {
                customer.loyalty = {
                    loyaltyReferenceNumber: `CUST-${customer._id.toString().slice(-6)}`,
                    redeemedPoints: 0,
                };
            }

            const currentRedeemedPoints = parseFloat(customer.loyalty.redeemedPoints) || 0;

            if (claimedPoints > currentRedeemedPoints) {
                console.warn(
                    `Claimed points (${claimedPoints}) exceed available points (${currentRedeemedPoints}) for customer ${customer.name}`
                );
            }

            // Calculate new points: current points - claimed points + redeemed points difference
            const newRedeemedPoints = Math.max(0, currentRedeemedPoints - claimedPoints) + pointsDifference;

            customer.loyalty.redeemedPoints = newRedeemedPoints;
            await customer.save();

            console.log(
                `Updated customer ${customer.name} points: ${currentRedeemedPoints} -> ${newRedeemedPoints} (Claimed: ${claimedPoints}, Points Difference: ${pointsDifference})`
            );
        } else {
            console.warn(
                `Customer ${updateData.customer} not found for points update`
            );
        }
    }
} catch (pointsError) {
    console.error("Error updating customer loyalty points:", pointsError);
    // Don't throw error here as it shouldn't prevent the sale update
}
    console.log("\uD83D\uDD04 Updating sale in DB...");
    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        ...updateData,
        warehouse: existingSale.warehouse,
        customer: existingSale.customer,
      },
      { new: true, runValidators: true }
    );

    console.log("\uD83D\uDCB0 Updating cash register balance...");
    const previousPaidAmount = parseFloat(existingSale.paidAmount);
    const newPaidAmount = parseFloat(updateData.paidAmount);
    const paidAmountDifference = newPaidAmount - previousPaidAmount;

    const cashRegister = await Cash.findOne();
    if (cashRegister) {
      cashRegister.totalBalance =
        parseFloat(cashRegister.totalBalance) + paidAmountDifference;
      await cashRegister.save();
    } else {
      return res.status(200).json({ message: "Cash register not found" });
    }

    // Update SalePayment model for payment type changes
    const existingPayments = await SalePayment.find({ saleId });
    const updatedPaymentTypes = updateData.paymentType;

    for (const paymentType of updatedPaymentTypes) {
      const existingPayment = existingPayments.find(
        (payment) => payment.paymentType === paymentType.type
      );
      if (existingPayment) {
        existingPayment.payingAmount = paymentType.amount;
        await existingPayment.save();
      } else {
        const newPayment = new SalePayment({
          saleId,
          amountToPay: updatedSale.grandTotal,
          payingAmount: paymentType.amount,
          currentDate: updateData.date || Date.now(),
          paymentType: paymentType.type,
        });
        await newPayment.save();
      }
    }

    console.log(
      "✅ Sale update successful:",
      JSON.stringify(updatedSale, null, 2)
    );
    return res
      .status(200)
      .json({ message: "Sale updated successfully", sale: updatedSale });
  } catch (error) {
    console.error("❌ Error updating sale:", error);
    return res
      .status(500)
      .json({ message: "Failed to update sale", error: error.message });
  }
};

//Delete a product from sale
const deleteProductFromSale = async (req, res) => {
  const { saleID, productID, total } = req.query; // `productID` refers to `currentID` in `productsData`
  if (!saleID) {
    return res.status(400).json({ message: "sale ID is required" });
  }
  if (!productID) {
    return res.status(400).json({ message: "product ID is required" });
  }
  try {
    // Step 1: Find the sale by saleID
    const sale = await Sale.findById(saleID);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    // Step 2: Check if the product exists in the sale's productsData
    const productToDelete = sale.productsData.find(
      (product) => product.currentID === productID
    );
    if (!productToDelete) {
      return res.status(404).json({ message: "Product not found in sale" });
    }

    // Step 3: Calculate the new grandTotal after removing the product's subtotal
    const newGrandTotal = sale.grandTotal - productToDelete.subtotal;

    // Step 4: Update the sale by pulling the product out of productsData and updating grandTotal
    const updatedSale = await Sale.findByIdAndUpdate(
      saleID,
      {
        $pull: { productsData: { currentID: productID } }, // Remove the product from the array
        grandTotal: newGrandTotal, // Update the grandTotal
      },
      { new: true } // Return the updated document
    );

    // Step 5: Respond with success if the sale was updated
    if (updatedSale) {
      res
        .status(200)
        .json({ message: "Product deleted successfully", sale: updatedSale });
    } else {
      res.status(404).json({ message: "Sale not found" });
    }
  } catch (error) {
    console.error("Error deleting product from sale:", error);
    res
      .status(500)
      .json({ message: "An error occurred while deleting the product" });
  }
};

// Backend Controller to Fetch Sales
const fetchSales = async (req, res) => {
  const { id, keyword } = req.query;
  try {
    let sales;

    // Fetch by ID if 'id' is provided in query
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid sale ID format" });
      }

      // Fetch sale as a plain JavaScript object with .lean()
      const sale = await Sale.findById(id).lean();
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }

      const productIds = sale.productsData.map((product) => product.currentID);
      const products = await Product.find({ _id: { $in: productIds } }).lean();
      const updatedProductsData = sale.productsData.map((productData) => {
        const baseProduct = products.find(
          (p) => p._id.toString() === productData.currentID
        );

        let stockQty = "";
        if (baseProduct) {
          if (
            baseProduct.variationValues &&
            baseProduct.variationValues.size > 0
          ) {
            const variation = baseProduct.variationValues.get(
              productData.variationValue
            );
            stockQty = variation ? variation.productQty || "" : "";
          } else {
            stockQty = baseProduct.productQty || "";
          }
        }
        return {
          ...productData,
          stockQty,
        };
      });
      // Create the final sale object with updated productsData
      const saleWithUpdatedProducts = {
        ...sale,
        productsData: updatedProductsData,
      };

      // Send the response with the updated sale object
      return res.status(200).json(saleWithUpdatedProducts);
    }

    // Fetch by keyword (matches customer name or reference ID)
    if (keyword) {
      if (keyword.length < 1) {
        return res
          .status(400)
          .json({ message: "Please provide a valid keyword." });
      }

      sales = await Sale.find({
        $or: [
          { customer: { $regex: new RegExp(keyword, "i") } },
          { refferenceId: { $regex: new RegExp(keyword, "i") } },
        ],
      });

      if (!sales || sales.length === 0) {
        return res
          .status(404)
          .json({ message: "No sales found matching the provided keyword." });
      }

      return res.status(200).json(sales);
    }
    if (req.query.page) {
      const size = parseInt(req.query.page.size) || 10; // Default size is 10
      const number = parseInt(req.query.page.number) || 1; // Default page number is 1
      const offset = (number - 1) * size; // Calculate the offset for pagination
      // const sort = req.query.sort || ''; // Handle sorting if provided

      sales = await Sale.find()
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(size);

      const totalSales = await Sale.countDocuments(); // Total sales count
      return res.status(200).json({
        sales,
        total: totalSales,
        size,
        number,
        totalPages: Math.ceil(totalSales / size),
      });
    } else {
      sales = await Sale.find();
      if (!sales || sales.length === 0) {
        return res.status(404).json({ message: "No sales found." });
      }

      return res.status(200).json(sales);
    }
  } catch (error) {
    console.error("Error fetching sales:", error);
    res
      .status(500)
      .json({ message: "Error fetching sales", error: error.message });
  }
};

const searchSale = async (req, res) => {
  const { keyword } = req.query; // Get keyword from query params

  try {
    if (!keyword) {
      return res.status(400).json({
        status: "error",
        message: "Keyword is required for search.",
      });
    }

    // Escape special regex characters in the keyword to prevent regex injection
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Build query to search by customer, reference ID, or invoice number
    const query = {
      $or: [
        { customer: { $regex: new RegExp(`${escapedKeyword}`, "i") } }, // Case-insensitive search
        { refferenceId: { $regex: new RegExp(`${escapedKeyword}`, "i") } },
        { invoiceNumber: { $regex: new RegExp(`${escapedKeyword}`, "i") } }, // Added invoiceNumber search
      ],
    };

    // Fetch sales based on the query
    const sales = await Sale.find(query).populate(
      "productsData.currentID",
      "productName productQty"
    );

    if (!sales || sales.length === 0) {
      return res.status(404).json({
        status: "unsuccess",
        message: "No sales found for the provided keyword.",
      });
    }

    // Format sales data if additional processing is needed
    const formattedSales = sales.map((sale) => {
      const saleObj = sale.toObject();

      return {
        _id: saleObj._id,
        refferenceId: saleObj.refferenceId,
        invoiceNumber: saleObj.invoiceNumber, // Ensure invoice number is included in the response
        customer: saleObj.customer,
        grandTotal: saleObj.grandTotal,
        orderStatus: saleObj.orderStatus,
        paymentStatus: saleObj.paymentStatus,
        paymentType: saleObj.paymentType,
        paidAmount: saleObj.paidAmount,
        warehouse: saleObj.warehouse,
        date: saleObj.date,
        discount: saleObj.discount,
        discountType: saleObj.discountType,
        offerPercentage: saleObj.offerPercentage,
        shipping: saleObj.shipping,
        tax: saleObj.tax,
        productsData: saleObj.productsData, // Include product details
        creditDetails: saleObj.creditDetails,
        useCreditPayment: saleObj.useCreditPayment,
        createdAt: saleObj.createdAt
          ? saleObj.createdAt.toISOString().slice(0, 10)
          : null,
      };
    });

    return res.status(200).json({
      status: "success",
      sales: formattedSales,
    });
  } catch (error) {
    console.error("Search sales error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

const fetchTodaySales = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      date: {
        $gte: todayStart,
        $lte: todayEnd,
      },
    }).lean();

    if (!sales || sales.length === 0) {
      return res.status(404).json({ message: "No sales found for today." });
    }

    const productIds = sales.flatMap((sale) =>
      sale.productsData.map((product) => product.currentID)
    );
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    const salesWithUpdatedProducts = sales.map((sale) => {
      const updatedProductsData = sale.productsData.map((productData) => {
        const baseProduct = products.find(
          (p) => p._id.toString() === productData.currentID
        );
        const warehouseKey = productData.warehouse;

        if (baseProduct) {
          let stockQty = "";
          let productCost = "";
          const selectedWarehouse = baseProduct.warehouse[warehouseKey];

          if (!selectedWarehouse) {
            console.error(
              `Warehouse ${warehouseKey} not found for product with ID: ${baseProduct._id}`
            );
            return {
              ...productData,
              stockQty: "N/A",
              productCost,
            };
          }

          if (productData.variationValue && selectedWarehouse.variationValues) {
            const variation =
              selectedWarehouse.variationValues[productData.variationValue];
            if (variation) {
              stockQty = variation.productQty || "";
              productCost = variation.productCost || "";
            } else {
              console.error(
                `Variation ${productData.variationValue} not found for product with ID: ${baseProduct._id}`
              );
            }
          } else {
            stockQty = selectedWarehouse.productQty || "";
            productCost = selectedWarehouse.productCost || "";
          }

          return {
            currentID: productData.currentID,
            variationValues: selectedWarehouse.variationValues,
            selectedVariation: productData.variationValue,
            name: productData.name,
            price: productData.price,
            productCost,
            ptype: productData.ptype,
            discount: productData.discount,
            specialDiscount: productData.specialDiscount,
            quantity: productData.quantity,
            stockQty,
            taxRate: productData.taxRate,
            subtotal: productData.subtotal,
            warehouse: productData.warehouse,
            _id: productData._id,
          };
        }
        console.warn(
          `Base product with currentID ${productData.currentID} not found.`
        );
        return productData;
      });

      return {
        ...sale,
        productsData: updatedProductsData,
      };
    });

    res.status(200).json(salesWithUpdatedProducts);
  } catch (error) {
    console.error("❌ Error fetching today's sales:", error);
    res
      .status(500)
      .json({ message: "Error fetching today's sales", error: error.message });
  }
};

const fetchLastWeekSales = async (req, res) => {
  try {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    lastWeek.setHours(0, 0, 0, 0);
    today.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      date: {
        $gte: lastWeek,
        $lte: today,
      },
    }).lean();

    if (!sales || sales.length === 0) {
      return res
        .status(404)
        .json({ message: "No sales found for the last week." });
    }

    const productIds = sales.flatMap((sale) =>
      sale.productsData.map((product) => product.currentID)
    );
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    const salesWithUpdatedProducts = sales.map((sale) => {
      const updatedProductsData = sale.productsData.map((productData) => {
        const baseProduct = products.find(
          (p) => p._id.toString() === productData.currentID
        );
        const warehouseKey = productData.warehouse;

        if (baseProduct) {
          let stockQty = "";
          let productCost = "";
          const selectedWarehouse = baseProduct.warehouse[warehouseKey];

          if (!selectedWarehouse) {
            console.error(
              `Warehouse ${warehouseKey} not found for product with ID: ${baseProduct._id}`
            );
            return {
              ...productData,
              stockQty: "N/A",
              productCost,
            };
          }

          if (productData.variationValue && selectedWarehouse.variationValues) {
            const variation =
              selectedWarehouse.variationValues[productData.variationValue];
            if (variation) {
              stockQty = variation.productQty || "";
              productCost = variation.productCost || "";
            } else {
              console.error(
                `Variation ${productData.variationValue} not found for product with ID: ${baseProduct._id}`
              );
            }
          } else {
            stockQty = selectedWarehouse.productQty || "";
            productCost = selectedWarehouse.productCost || "";
          }

          return {
            currentID: productData.currentID,
            variationValues: selectedWarehouse.variationValues,
            selectedVariation: productData.variationValue,
            name: productData.name,
            price: productData.price,
            productCost,
            ptype: productData.ptype,
            discount: productData.discount,
            specialDiscount: productData.specialDiscount,
            quantity: productData.quantity,
            stockQty,
            taxRate: productData.taxRate,
            subtotal: productData.subtotal,
            warehouse: productData.warehouse,
            productProfit: productData.productProfit,
            _id: productData._id,
          };
        }
        console.warn(
          `Base product with currentID ${productData.currentID} not found.`
        );
        return productData;
      });

      return {
        ...sale,
        productsData: updatedProductsData,
      };
    });

    res.status(200).json(salesWithUpdatedProducts);
  } catch (error) {
    console.error("❌ Error fetching last week's sales:", error);
    res.status(500).json({
      message: "Error fetching last week's sales",
      error: error.message,
    });
  }
};

const fetchLastMonthSales = async (req, res) => {
  try {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);
    lastMonth.setHours(0, 0, 0, 0); // Ensure start of the day for last month
    today.setHours(23, 59, 59, 999); // Ensure end of the day for today

    const sales = await Sale.find({
      date: {
        $gte: lastMonth,
        $lte: today,
      },
    }).lean();

    if (!sales || sales.length === 0) {
      return res
        .status(404)
        .json({ message: "No sales found for the last month." });
    }

    const productIds = sales.flatMap((sale) =>
      sale.productsData.map((product) => product.currentID)
    );
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    const salesWithUpdatedProducts = sales.map((sale) => {
      const updatedProductsData = sale.productsData.map((productData) => {
        const baseProduct = products.find(
          (p) => p._id.toString() === productData.currentID
        );
        const warehouseKey = productData.warehouse;

        if (baseProduct) {
          let stockQty = "";
          let productCost = "";
          const selectedWarehouse = baseProduct.warehouse[warehouseKey];

          if (!selectedWarehouse) {
            console.error(
              `Warehouse ${warehouseKey} not found for product with ID: ${baseProduct._id}`
            );
            return {
              ...productData,
              stockQty: "N/A",
              productCost,
            };
          }

          if (productData.variationValue && selectedWarehouse.variationValues) {
            const variation =
              selectedWarehouse.variationValues[productData.variationValue];
            if (variation) {
              stockQty = variation.productQty || "";
              productCost = variation.productCost || "";
            } else {
              console.error(
                `Variation ${productData.variationValue} not found for product with ID: ${baseProduct._id}`
              );
            }
          } else {
            stockQty = selectedWarehouse.productQty || "";
            productCost = selectedWarehouse.productCost || "";
          }

          return {
            currentID: productData.currentID,
            variationValues: selectedWarehouse.variationValues,
            selectedVariation: productData.variationValue,
            name: productData.name,
            price: productData.price,
            productCost,
            ptype: productData.ptype,
            discount: productData.discount,
            specialDiscount: productData.specialDiscount,
            quantity: productData.quantity,
            stockQty,
            taxRate: productData.taxRate,
            subtotal: productData.subtotal,
            warehouse: productData.warehouse,
            _id: productData._id,
          };
        }
        console.warn(
          `Base product with currentID ${productData.currentID} not found.`
        );
        return productData;
      });

      return {
        ...sale,
        productsData: updatedProductsData,
      };
    });
    res.status(200).json(salesWithUpdatedProducts);
  } catch (error) {
    console.error("❌ Error fetching last month's sales:", error);
    res.status(500).json({
      message: "Error fetching last month's sales",
      error: error.message,
    });
  }
};

const fetchLastYearSales = async (req, res) => {
  try {
    const today = new Date();
    const lastYear = new Date(today);
    lastYear.setFullYear(today.getFullYear() - 1);
    lastYear.setHours(0, 0, 0, 0); // Ensure start of the day for last year
    today.setHours(23, 59, 59, 999); // Ensure end of the day for today

    const sales = await Sale.find({
      date: {
        $gte: lastYear,
        $lte: today,
      },
    }).lean();

    if (!sales || sales.length === 0) {
      return res
        .status(404)
        .json({ message: "No sales found for the last year." });
    }

    const productIds = sales.flatMap((sale) =>
      sale.productsData.map((product) => product.currentID)
    );
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    const salesWithUpdatedProducts = sales.map((sale) => {
      const updatedProductsData = sale.productsData.map((productData) => {
        const baseProduct = products.find(
          (p) => p._id.toString() === productData.currentID
        );
        const warehouseKey = productData.warehouse;

        if (baseProduct) {
          let stockQty = "";
          let productCost = "";
          const selectedWarehouse = baseProduct.warehouse[warehouseKey];

          if (!selectedWarehouse) {
            console.error(
              `Warehouse ${warehouseKey} not found for product with ID: ${baseProduct._id}`
            );
            return {
              ...productData,
              stockQty: "N/A",
              productCost,
            };
          }

          if (productData.variationValue && selectedWarehouse.variationValues) {
            const variation =
              selectedWarehouse.variationValues[productData.variationValue];
            if (variation) {
              stockQty = variation.productQty || "";
              productCost = variation.productCost || "";
            } else {
              console.error(
                `Variation ${productData.variationValue} not found for product with ID: ${baseProduct._id}`
              );
            }
          } else {
            stockQty = selectedWarehouse.productQty || "";
            productCost = selectedWarehouse.productCost || "";
          }

          return {
            currentID: productData.currentID,
            variationValues: selectedWarehouse.variationValues,
            selectedVariation: productData.variationValue,
            name: productData.name,
            price: productData.price,
            productCost,
            ptype: productData.ptype,
            discount: productData.discount,
            specialDiscount: productData.specialDiscount,
            quantity: productData.quantity,
            stockQty,
            taxRate: productData.taxRate,
            subtotal: productData.subtotal,
            warehouse: productData.warehouse,
            _id: productData._id,
          };
        }
        console.warn(
          `Base product with currentID ${productData.currentID} not found.`
        );
        return productData;
      });

      return {
        ...sale,
        productsData: updatedProductsData,
      };
    });

    res.status(200).json(salesWithUpdatedProducts);
  } catch (error) {
    console.error("❌ Error fetching last year's sales:", error);
    res.status(500).json({
      message: "Error fetching last year's sales",
      error: error.message,
    });
  }
};

// GET /api/printInvoice/:saleId
const printInvoice = async (req, res) => {
  try {
    const { saleId } = req.params;
    const sale = await Sale.findById(saleId).lean();
    const settings = await Settings.findOne();

    if (!sale || !settings) {
      return res.status(404).json({ message: "Sale or settings not found" });
    }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const logoUrl = settings.logo
            ? `${baseUrl}/${settings.logo.replace(/\\/g, "/")}`
            : null;

        const templateData = {
            settings: {
                companyName: settings.companyName || 'IDEAZONE',
                companyAddress: settings.address || 'Address: XXX-XXX-XXXX',
                companyMobile: settings.companyMobile || 'Phone: XXX-XXX-XXXX',
                logo: logoUrl,
            },
            newSale: {
                cashierUsername: sale.cashierUsername || '',
                invoiceNumber: sale.invoiceNumber || '',
                date: sale.date ? formatDate(sale.date) : '',
                customer: sale.customer || '',
                productsData: sale.productsData.map(product => ({
                    name: product.name,
                    warranty: product.warranty || '',
                    price: product.price,
                    appliedWholesale: product.appliedWholesale,
                    quantity: product.quantity,
                    subtotal: product.subtotal,
                    taxRate: product.taxRate || 0,
                    taxType: product.taxType || 'exclusive',
                })),
                baseTotal: sale.baseTotal || 0,
                grandTotal: sale.grandTotal,
                discount: sale.discountValue || 0,
                cashBalance: sale.cashBalance || 0,
                paymentType: sale.paymentType,
                note:
          sale.note && sale.note !== "null" && sale.note.trim() !== ""
            ? sale.note
            : "",
        claimedPoints: sale.claimedPoints || 0,
        redeemedPointsFromSale: sale.redeemedPointsFromSale || 0,
            },
        };

    const invoiceTemplate = `
        <div style="font-family: Arial, sans-serif; position: absolute; left: 0; top: 0;">
            <style>
                /* Base Styles */
                body {
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                    color: #333;
                }
                    {
                        width: "148mm", // A5 landscape width
                        minHeight: "210mm", // A5 landscape height
                        margin: "0 auto",
                        boxShadow: "none",
                        pageBreakInside: "avoid"
                    }
                
                <div style="font-family: Arial, sans-serif; position: absolute; left: 0; top: 0;">
            <style>
                /* Base Styles */
                body {
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                    color: #333;
                }
                
                /* Print Styles */
                @media print {
                    body, .print-container {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    @page {
                        size: A5 portrait;
                        margin: 0;
                        padding: 0;
                    }
                    .product-row {
                        page-break-inside: avoid;
                    }
                    .page-break {
                        page-break-before: always;
                    }
                }
                
                /* Receipt Container */
                .receipt-container {
                    width: 148mm;
                    min-height: 210mm;
                    margin: 0;
                    padding: 10mm;
                    background-color: white;
                    border: 1px solid #d1d5db;
                    box-shadow: none;
                    page-break-inside: avoid;
                }
                
                .print-container {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                
                /* Company Header */
                .company-header {
                    text-align: center;
                    color: #000000;
                    margin-bottom: 20px;
                }
                
                .logo-container {
                    width: 100%;
                    text-align: center;
                    margin-bottom: 8px;
                }
                
                .logo-placeholder {
                    height: 60px;
                    background: linear-gradient(45deg, #8B4513, #D2691E, #F4A460, #DEB887);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                    color: #654321;
                    position: relative;
                    margin-bottom: 10px;
                }
                
                .company-name {
                    font-size: 18px;
                    font-weight: bold;
                    color: #000000;
                    margin-bottom: 2px;
                }
                
                .company-tagline {
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 15px;
                }
                
                /* Invoice Meta Section */
                .invoice-meta {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    margin-top: 30px;
                    font-size: 15px;
                    color: #000000;
                }
                
                .meta-left {
                    flex: 1;
                    text-align: left;
                }
                
                .meta-right {
                    text-align: right;
                }
                
                .meta-item {
                    margin-bottom: 3px;
                    color: #000000;
                }
                
                /* Divider Line */
                .divider {
                    width: 100%;
                    border-top: 1px solid #000;
                    margin: 8px 0;
                    margin-top: 30px
                }
                
                /* Products Section */
                .products-section {
                    margin-top: 40px;
                }
                
                .products-header {
                    display: flex;
                    font-weight: bold;
                    font-size: 15px;
                    margin-bottom: 8px;
                    color: #000000;
                }
                
                .col-product {
                    flex: 3;
                    text-align: left;
                }
                
                .col-quantity {
                    flex: 1;
                    text-align: center;
                }
                
                .col-price {
                    flex: 1.2;
                    text-align: right;
                }
                
                .col-subtotal {
                    flex: 1.2;
                    text-align: right;
                }
                
                .product-row {
                    display: flex;
                    font-size: 14px;
                    margin-bottom: 5px;
                    color: #000000;
                    align-items: flex-start;
                }
                
                .product-name {
                    word-wrap: break-word;
                    line-height: 1.2;
                }
                
                /* Payment Summary */
                .payment-summary {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 18px;
                    font-size: 15px;
                    color: #000000;
                }
                
                .payment-left {
                    flex: 1;
                }
                
                .payment-right {
                    flex: 1;
                    text-align: right;
                }
                
                .payment-item {
                    margin-bottom: 3px;
                }
                
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 3px;
                }
                
                .summary-row.total {
                    font-size: 16px;
                    margin-top: 5px;
                }

                .system-by {
                    font-size: 14px;
                    text-align: center;
                    margin-top: 4px;
                    color: #000000;
                }
            </style>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>

            <!-- Company Header Section -->
            <div class="receipt-container">
                <!-- Company Header -->
                <div class="company-header">
                    <!-- Logo Container -->
                    <div style="overflow: hidden; display: flex; justify-content: center; align-items: center; ">
                    <img src="{{settings.logo}}" alt="Logo" style="max-height: 100px; max-width: 100%; margin: 2px auto;">
                    </div>
                </div>

                <!-- Invoice Meta Section -->
                <div class="invoice-meta">
                    <!-- Left: Invoice Meta Data -->
                    <div class="meta-left">
                        <div class="meta-item"><b>Invoice No.</b> {{newSale.invoiceNumber}}</div>
                        <div class="meta-item"><b>Customer</b></div>
                        <div class="meta-item">{{newSale.customer}}</div>
                        <div class="meta-item"><b>Mobile:</b> {{formatMobile settings.companyMobile}}</div>
                    </div>

                    <!-- Right: Date -->
                    <div class="meta-right">
                        <div class="meta-item"><b>Date</b> {{newSale.date}}</div>
                    </div>
                </div>

                <!-- Products Section -->
                <div class="products-section">
                    <div class="products-header">
                        <div class="col-product">Product</div>
                        <div class="col-quantity">Quantity</div>
                        <div class="col-price">Unit Price</div>
                        <div class="col-subtotal">Subtotal</div>
                    </div>

                    {{#each newSale.productsData}}
                    <div class="product-row">
                        <div class="col-product">
                            <div class="product-name">
                                {{this.name}}
                                {{#if this.appliedWholesale}}
                                    <span style="display: inline-block; background-color: #f3f4f6; color: #000000; border: 1px solid #000000; border-radius: 4px; padding: 1px 4px; font-size: 12px; font-weight: bold; margin-left: 4px;">
                                        W
                                    </span>
                                {{/if}}
                            </div>
                        </div>
                        <div class="col-quantity">{{this.quantity}} pcs</div>
                        <div class="col-price">{{formatCurrency this.price}}</div>
                        <div class="col-subtotal">{{formatCurrency this.subtotal}}</div>
                    </div>
                    {{/each}}
                </div>

                <div class="divider"></div>

                <!-- Payment Summary -->
                <div class="payment-summary">
                    <div class="payment-left">
                        {{#each newSale.paymentType}}
                        <div class="payment-item">
                            <b>{{this.type}}</b> {{formatCurrency this.amount}}
                        </div>
                        {{/each}}
                        <div class="payment-item">
                            <b>Total Paid</b> {{formatCurrency newSale.grandTotal}}
                        </div>
                    </div>

                    <div class="payment-right">
                        <!-- Loyalty Points Section (Before Subtotal) -->
                        <div class="summary-row">
                            <span><b>Claimed Points:</b></span>
                            <span>{{newSale.claimedPoints}}</span>
                        </div>
                        <div class="summary-row">
                            <span><b>Redeemed Points From Sale:</b></span>
                            <span>{{newSale.redeemedPointsFromSale}}</span>
                        </div>
                        
                        <!-- Calculate subtotal as sum of all products -->
                        <div class="summary-row">
                            <span><b>Subtotal:</b></span>
                            <span>Rs {{formatCurrency newSale.baseTotal}}</span>
                        </div>
                        <div class="summary-row">
                            <span><b>Discount</b></span>
                            <span>(-) Rs {{formatCurrency newSale.discount}}</span>
                        </div>
                        <div class="summary-row total">
                            <span><b>Total:</b></span>
                            <span>Rs {{formatCurrency newSale.grandTotal}}</span>
                        </div>
                    </div>
                </div>

                {{#isValidNote newSale.note}}
                    <div style="margin-bottom:10px; font-size: 15px;  word-wrap: break-word; overflow-wrap: break-word;">
                        <p style="margin-top: 3px; 0; margin-bottom: 3px font-size: 12px; white-space: pre-wrap; word-break: break-word;">
                        Note: {{newSale.note}}
                    </p>
                    </div>
                {{/isValidNote}}

                </div>
            </div>
        </div>`;

    Handlebars.registerHelper("isValidNote", function (note, options) {
      // Check if note is valid (not null, undefined, "null", or empty/whitespace only)
      return note &&
        note !== null &&
        note !== "null" &&
        note.toString().trim() !== ""
        ? options.fn(this)
        : options.inverse(this);
    });

    const compiledTemplate = Handlebars.compile(invoiceTemplate); //  reuse the same template string
    const html = compiledTemplate(templateData);

    res.status(200).json({ html, status: "success" });
  } catch (error) {
    console.error("Error generating invoice HTML:", error);
    res
      .status(500)
      .json({ message: "Error generating invoice", error: error.message });
  }
};

module.exports = {
  createSale,
  createNonPosSale,
  deleteSale,
  payingForSale,
  deletePaymentOfSale,
  fetchPaymentBySaleId,
  findSaleById,
  updateSale,
  deleteProductFromSale,
  fetchSales,
  searchSale,
  fetchTodaySales,
  fetchLastWeekSales,
  fetchLastMonthSales,
  fetchLastYearSales,
  printInvoice,
};
