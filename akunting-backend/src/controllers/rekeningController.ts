import { Request, Response } from 'express';
import Rekening from '../models/Rekening';
import Bank from '../models/Bank';

export const getAllRekenings = async (req: Request, res: Response) => {
  try {
    const rekenings = await Rekening.find().populate('bank_id');
    res.json(rekenings);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data rekening.' });
  }
};

export const getRekeningById = async (req: Request, res: Response) => {
  try {
    const rekening = await Rekening.findById(req.params.id).populate('bank_id');
    if (!rekening) return res.status(404).json({ message: 'Rekening tidak ditemukan.' });
    res.json(rekening);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data rekening.' });
  }
};


export const createRekening = async (req: Request, res: Response) => {
  try {
    const { bank_id, no_rekening, nama_rekening, saldo } = req.body;
    // Cari kode_bank dari bank_id
    const bank = await Bank.findById(bank_id);
    if (!bank) return res.status(400).json({ message: 'Bank tidak ditemukan.' });
    const rekening = new Rekening({
      bank_id,
      kode_bank: bank.kode_bank,
      no_rekening,
      nama_rekening,
      saldo: saldo || 0
    });
    await rekening.save();
    res.status(201).json(rekening);
  } catch (err) {
    res.status(400).json({ message: 'Gagal menambah rekening.' });
  }
};


export const updateRekening = async (req: Request, res: Response) => {
  try {
    const { bank_id, no_rekening, nama_rekening, saldo } = req.body;
    // Cari kode_bank dari bank_id
    const bank = await Bank.findById(bank_id);
    if (!bank) return res.status(400).json({ message: 'Bank tidak ditemukan.' });
    const rekening = await Rekening.findByIdAndUpdate(
      req.params.id,
      { bank_id, kode_bank: bank.kode_bank, no_rekening, nama_rekening, saldo: saldo || 0 },
      { new: true }
    );
    if (!rekening) return res.status(404).json({ message: 'Rekening tidak ditemukan.' });
    res.json(rekening);
  } catch (err) {
    res.status(400).json({ message: 'Gagal update rekening.' });
  }
};

export const deleteRekening = async (req: Request, res: Response) => {
  try {
    const rekening = await Rekening.findByIdAndDelete(req.params.id);
    if (!rekening) return res.status(404).json({ message: 'Rekening tidak ditemukan.' });
    res.json({ message: 'Rekening berhasil dihapus.' });
  } catch (err) {
    res.status(400).json({ message: 'Gagal hapus rekening.' });
  }
};
