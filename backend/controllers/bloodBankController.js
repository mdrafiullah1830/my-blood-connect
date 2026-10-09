const mongoose = require('mongoose');
const BloodBank = require('../models/BloodBank');

// hospital/blood bank search — city, type, stock availability diye filter.
const searchBanks = async (req, res) => {
    try {
        const { city, district, type, bloodGroup, q } = req.query;
        const query = { active: true };
        if (city && city !== 'All') query.city = city;
        if (district && district !== 'All') query.district = district;
        if (type && ['hospital', 'blood_bank', 'clinic'].includes(type)) query.type = type;
        if (bloodGroup && bloodGroup !== 'All') query['stock.bloodGroup'] = bloodGroup;
        if (q) query.$text = { $search: String(q).slice(0, 100) };

        let banks = await BloodBank.find(query).sort({ name: 1 }).limit(100).lean();
        if (bloodGroup && bloodGroup !== 'All') {
            banks = banks.map((b) => {
                const stockItem = (b.stock || []).find((s) => s.bloodGroup === bloodGroup);
                return { ...b, requestedStock: stockItem ? stockItem.bags : 0 };
            }).filter((b) => b.requestedStock > 0);
        }
        res.json({ success: true, total: banks.length, banks });
    } catch (error) {
        console.error('Banks search failed:', error);
        res.status(500).json({ success: false, message: 'Unable to search blood banks' });
    }
};

const getBank = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
        const bank = await BloodBank.findOne({ _id: req.params.id, active: true }).lean();
        if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
        res.json({ success: true, bank });
    } catch (error) {
        console.error('Bank read failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load blood bank' });
    }
};

// ambulance/hospital emergency contact list — frontend emergency page e dekhay.
const emergencyContacts = async (req, res) => {
    try {
        const query = { active: true };
        if (req.query.city && req.query.city !== 'All') query.city = req.query.city;
        const banks = await BloodBank.find(query)
            .select('name type city address phone emergencyPhone ambulancePhone location')
            .lean();
        const contacts = banks.filter((b) => b.emergencyPhone || b.ambulancePhone || b.phone);
        res.json({ success: true, contacts });
    } catch (error) {
        console.error('Emergency contacts failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load emergency contacts' });
    }
};

const createBank = async (req, res) => {
    try {
        const { name, address, city, type = 'hospital', district = '', division = '', phone = '', emergencyPhone = '', ambulancePhone = '', email = '', latitude, longitude, stock = [] } = req.body;
        if (!name || !address || !city) return res.status(400).json({ success: false, message: 'Name, address and city are required' });
        const bank = await BloodBank.create({
            name: String(name).slice(0, 150), address: String(address).slice(0, 300), city: String(city).slice(0, 100),
            type, district, division, phone, emergencyPhone, ambulancePhone, email,
            ...(latitude !== undefined && longitude !== undefined && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
                ? { location: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] } } : {}),
            stock: Array.isArray(stock) ? stock : []
        });
        res.status(201).json({ success: true, message: 'Blood bank created', bank });
    } catch (error) {
        console.error('Bank create failed:', error);
        res.status(500).json({ success: false, message: 'Unable to create blood bank' });
    }
};

// stock update — admin/manager ek group er bag count set kore.
const updateStock = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
        const { bloodGroup, bags } = req.body;
        const bagCount = Number(bags);
        if (!bloodGroup || !Number.isInteger(bagCount) || bagCount < 0) return res.status(400).json({ success: false, message: 'Valid bloodGroup and bags required' });
        const bank = await BloodBank.findById(req.params.id);
        if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
        const existing = bank.stock.find((s) => s.bloodGroup === bloodGroup);
        if (existing) { existing.bags = bagCount; existing.updatedAt = new Date(); }
        else bank.stock.push({ bloodGroup, bags: bagCount, updatedAt: new Date() });
        await bank.save();
        res.json({ success: true, message: 'Stock updated', bank });
    } catch (error) {
        console.error('Stock update failed:', error);
        res.status(500).json({ success: false, message: 'Unable to update stock' });
    }
};

const deleteBank = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
        const bank = await BloodBank.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
        if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
        res.json({ success: true, message: 'Blood bank deactivated' });
    } catch (error) {
        console.error('Bank delete failed:', error);
        res.status(500).json({ success: false, message: 'Unable to delete blood bank' });
    }
};

module.exports = { searchBanks, getBank, emergencyContacts, createBank, updateStock, deleteBank };
