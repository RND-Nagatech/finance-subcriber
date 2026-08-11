import fs from "fs";
import csv from "csv-parser";
import Subscriber from "../models/Subscriber";
import Program from "../models/Program";


// Resolve acting user from authenticated request only. Ignore client-supplied audit fields.
const resolveUserId = (req?: any) => {
  if (req && req.user && typeof req.user === 'object') {
    return (req.user as any).name || (req.user as any).username || (req.user as any).id || (req.user as any)._id || 'system';
  }
  if (typeof req?.user === 'string' && req.user.length > 0) return req.user;
  return 'ROBBI'; // Default for migration
};

// Helper function to generate next kode from the highest numeric kode in the collection.
const generateNextKode = async (model: any): Promise<string> => {
  const [lastDoc] = await model.aggregate([
    {
      $addFields: {
        kode_number: {
          $convert: {
            input: '$kode',
            to: 'int',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $match: { kode_number: { $ne: null } } },
    { $sort: { kode_number: -1 } },
    { $limit: 1 },
    { $project: { kode_number: 1 } },
  ]);

  const lastNum = Number(lastDoc?.kode_number || 0);
  const nextNum = lastNum + 1;
  return nextNum.toString().padStart(3, '0');
};

// === CSV MIGRATOR ===
export const migrateSubscriberFromCSV = async (csvPath: string) => {
  console.log("📥 Reading CSV:", csvPath);

  return new Promise<void>((resolve, reject) => {
    const results: any[] = [];

    fs.createReadStream(csvPath)
      .pipe(csv({ separator: ";" }))
      .on("data", (row : any) => {
        results.push(row);
      })
      .on("end", async () => {
        console.log(`📦 Total rows: ${results.length}`);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < results.length; i++) {
          const row = results[i];

          try {
            // Get program details
            const programName = row["PROGRAM"]?.trim() ?? "";
            //untuk biaya tolong regex angka saja
            const biaya = parseInt(row["BIAYA"]?.replace(/[^0-9]/g, '') || "0", 10);

            const tanggal = convertDate(row["TANGGAL"]);

            // Calculate prev_subscriber and current_subscriber
            const lastSubscriber = await Subscriber.findOne({
              program: programName,
              status_aktv: true
            }).sort({ input_date: -1 }).limit(1);
            const programExists = await Program.findOne({ nama: programName });
            if (!programExists) {
              await Program.create({
                nama: programName,
                kode: programName.toUpperCase().replace(/\s+/g, '_'),
                biaya: biaya,
                total_subscriber: 0,
                total_biaya_subscriber: 0,
                input_by: resolveUserId(),
              });
              console.log(`ℹ️  Created new program: ${programName}`);
            } else {
              await Program.updateOne(
                { nama: programName },
                { $inc: { total_subscriber: 1, total_biaya_subscriber: biaya } }
              );
            }


            const prevSubscriber = lastSubscriber ? lastSubscriber.current_subscriber : 0;
            const currentSubscriber = prevSubscriber + 1;
            const prevBiaya = lastSubscriber ? lastSubscriber.current_biaya : 0;
            const currentBiaya = prevBiaya + biaya;

            const userId = resolveUserId();
            const newKode = await generateNextKode(Subscriber);

            const payload = {
              kode: newKode,
              no_ok: row["NO OK"] || null,
              sales: row["SALES"] || null,
              toko: row["TOKO"],
              alamat: row["ALAMAT"] || null,
              daerah: row["DAERAH"] || "-",
              program: programName,
              vb_online: row["VB ONLINE"] || null,
              biaya: biaya,
              tanggal: tanggal,
              implementator: null,
              via: "VISIT",
              prev_subscriber: prevSubscriber,
              current_subscriber: currentSubscriber,
              prev_biaya: prevBiaya,
              current_biaya: currentBiaya,
              status_aktv: true,
              input_date: new Date(),
              update_date: new Date(),
              delete_date: null,
              input_by: userId,
              update_by: null,
              delete_by: null,
            };

            const subscriber = new Subscriber(payload);
            await subscriber.save();
            successCount++;

            if (successCount % 50 === 0) {
              console.log(`✅ Processed ${successCount}/${results.length} subscribers`);
            }

          } catch (error) {
            errorCount++;
            console.error(`❌ Error processing row ${i + 1} (${row["TOKO"]}):`, error);
          }
        }

        console.log(`\n🎉 Migration complete!`);
        console.log(`✅ Successfully inserted: ${successCount} subscribers`);
        console.log(`❌ Errors: ${errorCount} subscribers`);

        resolve();
      })
      .on("error", (error: any) => {
        console.error("❌ Error reading CSV:", error);
        reject(error);
      });
  });
};

// === Helper Convert Tanggal (01-Jan-2020 → 2020-01-01)
const convertDate = (input: string): Date => {
  return new Date(
    input.replace(/-/g, " ")
  );
};
