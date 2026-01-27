import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({}, { password: 0, credentials: 0, currentChallenge: 0 });
    return res.json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', err });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, name, password, role } = req.body;

    const updateData: any = {};
    if (username) updateData.username = username;
    if (name) updateData.name = name;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (role) updateData.role = role;

    const user = await User.findByIdAndUpdate(id, updateData, { new: true, select: '-password -credentials -currentChallenge' });
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', err });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', err });
  }
};