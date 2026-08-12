import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import Program from '../models/Program';
import GroupProgram from '../models/GroupProgram';

async function main() {
  await connectDB();

  const groups = await Program.distinct('group_program', {
    group_program: { $exists: true, $nin: [null, ''] },
  });

  let created = 0;
  let reactivated = 0;

  for (const group of groups) {
    const group_program = String(group || '').trim();
    if (!group_program) continue;

    const existing = await GroupProgram.findOne({ group_program });
    if (!existing) {
      await GroupProgram.create({
        group_program,
        input_by: 'system',
        update_by: null,
        delete_by: null,
      });
      created += 1;
      continue;
    }

    if (existing.status_aktv === false) {
      existing.status_aktv = true;
      existing.update_date = new Date();
      existing.update_by = 'system';
      await existing.save();
      reactivated += 1;
    }
  }

  console.log(`Created group program rows: ${created}`);
  console.log(`Reactivated group program rows: ${reactivated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
