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

const Purchase = require('../../models/purchaseModel');
const PurchaseReturn = require('../../models/purchaseReturnModel');
const Sale = require('../../models/saleModel');
const Cash = require('../../models/posModel/cashModel')
const SaleReturn = require('../../models/saleReturnModel');
const Customer = require('../../models/customerModel');
const Expenses = require('../../models/expensesModel');

const getReportData = async (req, res) => {
    const { warehouse } = req.params;
    try {
        // Define the warehouse filter
        const warehouseFilter = warehouse === 'all' ? {} : { warehouse };
        const [sales, saleReturns, purchases, purchaseReturns, expenses] = await Promise.all([
            Sale.find(warehouseFilter),
            SaleReturn.find(warehouseFilter),
            Purchase.find(warehouseFilter),
            PurchaseReturn.find(warehouseFilter),
            Expenses.find(warehouseFilter)
        ]);

        // Send the filtered data in a single response
        res.status(200).json({
            message: 'Report data fetched successfully',
            data: {
                sales,
                saleReturns,
                purchases,
                purchaseReturns,
                expenses
            }
        });
    } catch (error) {
        console.error("Error getting report data:", error);
        return res.status(500).json({ message: 'Server Error', status: 'fail', error: 'Something went wrong, please try again later.' });
    }
};

const getFillteredReportData = async (req, res) => {
    const { warehouse, orderStatus, paymentStatus, paymentType, date } = req.query;
    console.log( warehouse, orderStatus, paymentStatus, paymentType, date)
    try {
        // Filter logic
        const warehouseFilter = warehouse && warehouse !== 'all' ? { warehouse } : {};
        const orderStatusFilter = orderStatus && orderStatus !== 'all' ? { orderStatus } : {};
        const paymentStatusFilter = paymentStatus && paymentStatus !== 'all' ? { paymentStatus } : {};

        let paymentTypeFilter = {};
        if (paymentType && paymentType !== 'all' && paymentType.trim() !== '') {
            const paymentTypes = Array.isArray(paymentType) ? paymentType : [paymentType];
            paymentTypeFilter = {
                paymentType: {
                    $elemMatch: { type: { $in: paymentTypes } }
                }
            };
        }

        let dateFilter = {};
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            dateFilter = { date: { $gte: startOfDay, $lte: endOfDay } };
        }

        // Combine all filters into one
        const combinedFilter = {
            ...warehouseFilter,
            ...orderStatusFilter,
            ...paymentStatusFilter,
            ...paymentTypeFilter,
            ...dateFilter
        };

        console.log('Applied Filters:', { warehouseFilter, orderStatusFilter, paymentStatusFilter, paymentTypeFilter, dateFilter });

        // Query the database with the combined filter
        const [sales, saleReturns, purchases, purchaseReturns, expenses] = await Promise.all([
            Sale.find(combinedFilter),
            SaleReturn.find(combinedFilter),
            Purchase.find(combinedFilter),
            PurchaseReturn.find(combinedFilter),
            Expenses.find(warehouseFilter)
        ]);

        // Respond with the fetched data
        res.status(200).json({
            message: 'Report data fetched successfully',
            data: { sales, saleReturns, purchases, purchaseReturns, expenses }
        });
    } catch (error) {
        console.error("Error getting report data:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const allCustomerReport = async (req, res) => {
    const { name } = req.params;
    console.log(name)
    try {
        const customers = await Customer.find();
        if (!customers || customers.length === 0) {
            return res.status(404).json({ message: 'Customers not found' });
        }
        // Fetch sales data for each customer and filter out those with no sales
        const customersData = await Promise.all(customers.map(async (customer) => {
            const sales = await Sale.find(name);
            if (sales.length === 0) return null;  // Exclude customers with no sales

            return {
                _id: customer._id,
                name: customer.name,
                mobile: customer.mobile,
                sales: sales.map(sale => ({
                    saleId: sale._id,
                    warehouse: sale.warehouse,
                    date: sale.date,
                    amount: sale.grandTotal,
                    paid: sale.paidAmount,
                    paymentStatus: sale.paymentStatus,
                }))
            };
        }));
        // Filter out null values (customers with no sales)
        const filteredData = customersData.filter(customer => customer !== null);

        return res.status(200).json(filteredData);
    } catch (error) {
        // Log error for debugging
        console.error("Error getting report data:", error);

        // Return a more generic error message for unexpected issues
        return res.status(500).json({ message: 'Server Error', status: 'fail', error: 'Something went wrong, please try again later.' });
    }
}

const allCustomerReportById = async (req, res) => {
    const { name } = req.params
    try {
        const customers = await Customer.find({ name: name });
        if (!customers || customers.length === 0) {
            return res.status(404).json({ message: 'Customers not found' });
        }
        // Fetch sales data for each customer and filter out those with no sales
        const customersData = await Promise.all(customers.map(async (customer) => {
            const sales = await Sale.find({ customer: customer.name });
            if (sales.length === 0) return null;  // Exclude customers with no sales

            return {
                _id: customer._id,
                name: customer.name,
                mobile: customer.mobile,
                sales: sales.map(sale => ({
                    saleId: sale._id,
                    warehouse: sale.warehouse,
                    date: sale.date,
                    amount: sale.grandTotal,
                    paid: sale.paidAmount,
                    paymentStatus: sale.paymentStatus,
                }))
            };
        }));
        // Filter out null values (customers with no sales)
        const filteredData = customersData.filter(customer => customer !== null);

        return res.status(200).json(filteredData);
    } catch (error) {
        console.error('Error fetching customers with sales data:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

const findReportByCustomer = async (req, res) => {
    const { name } = req.query;

    if (!name) {
        return res.status(400).json({ message: 'Customer name is required' });
    }
    try {
        const customers = await Customer.find({ name: { $regex: name, $options: 'i' } });
        if (!customers) {
            return res.status(404).json({ message: 'No customers found' });
        }
        const customersData = await Promise.all(customers.map(async (customer) => {
            // Fetch sales by using the customer's ID instead of name
            const sales = await Sale.find({ customer: customer.name });
            if (sales.length === 0) return null;  // Exclude customers with no sales

            return {
                _id: customer._id,
                name: customer.name,
                mobile: customer.mobile,
                sales: sales.map(sale => ({
                    saleId: sale._id,
                    warehouse: sale.warehouse,
                    date: sale.date,
                    amount: sale.grandTotal,
                    paid: sale.paidAmount,
                    paymentStatus: sale.paymentStatus,
                }))
            };
        }));

        const filteredData = customersData.filter(customer => customer !== null);

        if (filteredData.length === 0) {
            return res.status(404).json({ message: 'No customers with sales found' });
        }
        return res.status(200).json(filteredData);
    } catch (error) {
        console.error('Error fetching customer report by name:', error);
        return res.status(500).json({ message: 'Internal server error', error });
    }
};

const getTodayReportData = async (req, res) => {
    const { warehouse } = req.params;
    const SRI_LANKA_OFFSET_MINUTES = 5.5 * 60;

    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const utcDate = now.getUTCDate();
    const startOfDay = new Date(Date.UTC(utcYear, utcMonth, utcDate, 0, 0, 0) - SRI_LANKA_OFFSET_MINUTES * 60 * 1000);
    const endOfDay = new Date(Date.UTC(utcYear, utcMonth, utcDate + 1, 0, 0, 0) - SRI_LANKA_OFFSET_MINUTES * 60 * 1000 - 1);

    console.log("Today Report Date Range:", startOfDay.toISOString(), endOfDay.toISOString());

    try {
        const warehouseFilter = warehouse === 'all' ? {} : { warehouse };
        const dateFilter = {
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        };
        const filter = { ...warehouseFilter, ...dateFilter };
        const [sales, saleReturns, purchases, purchaseReturns, expenses] = await Promise.all([
            Sale.find(filter),
            SaleReturn.find(filter),
            Purchase.find(filter),
            PurchaseReturn.find(filter),
            Expenses.find(filter)
        ]);
        res.status(200).json({
            message: 'Today report data fetched successfully',
            data: {
                sales,
                saleReturns,
                purchases,
                purchaseReturns,
                expenses
            }
        });

    } catch (error) {
        console.error("Error getting today report data:", error);
        return res.status(500).json({
            message: 'Server Error',
            status: 'fail',
            error: 'Something went wrong, please try again later.'
        });
    }
};

const getZReportData = async (req, res) => {
    const { cashRegisterID } = req.params;

    try {
        const cashRegister = await Cash.findById(cashRegisterID);
        if (!cashRegister) {
            return res.status(404).json({
                message: 'Cash register not found',
                status: 'fail'
            });
        }

        const salesFilter = {
            cashRegisterID: cashRegisterID,
            saleType: "POS"
        };

        const sales = await Sale.find(salesFilter)
            .sort({ date: 1 })
            .lean();

        const totals = {
            grandTotal: 0,
            pureProfit: 0,
            totalTransactions: sales.length,
            cashBalance: 0
        };

        sales.forEach(sale => {
            totals.grandTotal += parseFloat(sale.grandTotal) || 0;
            totals.pureProfit += parseFloat(sale.pureProfit) || 0;
            totals.cashBalance += parseFloat(sale.cashBalance) || 0;
        });

        // 4. Prepare response
        res.status(200).json({
            message: 'Z-Report data fetched successfully',
            data: {
                sales,
                totals,
                registerInfo: {
                    openTime: cashRegister.openTime,
                    currentTime: new Date().toString(),
                    cashier: cashRegister.name || cashRegister.username,
                    startingBalance: cashRegister.totalBalance,
                    registerId: cashRegister._id,
                    timezone: "Asia/Colombo (UTC+5:30)"
                }
            }
        });

    } catch (error) {
        console.error("Error in getZReportData:", error);
        res.status(500).json({
            message: 'Server Error',
            status: 'fail',
            error: error.message
        });
    }
};

const getLastWeekReportData = async (req, res) => {
    const { warehouse } = req.params;
    const SRI_LANKA_OFFSET_MINUTES = 5.5 * 60; 

    const now = new Date();
    const todayStart = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
    ) - SRI_LANKA_OFFSET_MINUTES * 60 * 1000);

    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const lastWeekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    try {
        const warehouseFilter = warehouse === 'all' ? {} : { warehouse };
        const dateFilter = {
            date: {
                $gte: lastWeekStart,
                $lte: todayEnd
            }
        };
        const filter = { ...warehouseFilter, ...dateFilter };

        const [sales, saleReturns, purchases, purchaseReturns, expenses] = await Promise.all([
            Sale.find(filter),
            SaleReturn.find(filter),
            Purchase.find(filter),
            PurchaseReturn.find(filter),
            Expenses.find(filter)
        ]);

        res.status(200).json({
            message: 'Last week report data fetched successfully',
            data: { sales, saleReturns, purchases, purchaseReturns, expenses }
        });
    } catch (error) {
        console.error("Error getting last week report data:", error);
        return res.status(500).json({
            message: 'Server Error',
            status: 'fail',
            error: 'Something went wrong, please try again later.'
        });
    }
};

const getLastMonthReportData = async (req, res) => {
    const { warehouse } = req.params;
    const SRI_LANKA_OFFSET_MINUTES = 5.5 * 60;
    const now = new Date();

    const todayStart = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
    ) - SRI_LANKA_OFFSET_MINUTES * 60 * 1000);

    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const lastMonthStart = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - 1,
        now.getUTCDate(),
        0, 0, 0, 0
    ) - SRI_LANKA_OFFSET_MINUTES * 60 * 1000);

    try {
        const warehouseFilter = warehouse === 'all' ? {} : { warehouse };
        const dateFilter = {
            date: {
                $gte: lastMonthStart,
                $lte: todayEnd
            }
        };
        const filter = { ...warehouseFilter, ...dateFilter };

        const [sales, saleReturns, purchases, purchaseReturns, expenses] = await Promise.all([
            Sale.find(filter),
            SaleReturn.find(filter),
            Purchase.find(filter),
            PurchaseReturn.find(filter),
            Expenses.find(filter)
        ]);

        res.status(200).json({
            message: 'Last month report data fetched successfully',
            data: { sales, saleReturns, purchases, purchaseReturns, expenses }
        });
    } catch (error) {
        console.error("Error getting last month report data:", error);
        return res.status(500).json({
            message: 'Server Error',
            status: 'fail',
            error: 'Something went wrong, please try again later.'
        });
    }
};

const getLastYearReportData = async (req, res) => {
    const { warehouse } = req.params;
    const SRI_LANKA_OFFSET_MINUTES = 5.5 * 60; 
    const now = new Date();

    const todayStart = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
    ) - SRI_LANKA_OFFSET_MINUTES * 60 * 1000);

    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const lastYearStart = new Date(Date.UTC(
        now.getUTCFullYear() - 1,
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
    ) - SRI_LANKA_OFFSET_MINUTES * 60 * 1000);

    try {
        const warehouseFilter = warehouse === 'all' ? {} : { warehouse };
        const dateFilter = {
            date: {
                $gte: lastYearStart,
                $lte: todayEnd
            }
        };
        const filter = { ...warehouseFilter, ...dateFilter };

        const [sales, saleReturns, purchases, purchaseReturns, expenses] = await Promise.all([
            Sale.find(filter),
            SaleReturn.find(filter),
            Purchase.find(filter),
            PurchaseReturn.find(filter),
            Expenses.find(filter)
        ]);

        res.status(200).json({
            message: 'Last year report data fetched successfully',
            data: { sales, saleReturns, purchases, purchaseReturns, expenses }
        });
    } catch (error) {
        console.error("Error getting last year report data:", error);
        return res.status(500).json({
            message: 'Server Error',
            status: 'fail',
            error: 'Something went wrong, please try again later.'
        });
    }
}

module.exports = { getReportData, allCustomerReport, allCustomerReportById, findReportByCustomer, getFillteredReportData, getTodayReportData, 
                   getLastWeekReportData, getLastMonthReportData, getLastYearReportData, getZReportData};
