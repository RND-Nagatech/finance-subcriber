import { Request, Response } from 'express';

export const rekapAggregate = async (req: Request, res: Response) => {
  const tahun = String(req.query.tahun || new Date().getFullYear());
  const filterBulan = req.query.bulan ? String(req.query.bulan).toUpperCase() : null;

  // Model
  const ThFinance = require('../models/ThFinance').default;
  const Transaksi = require('../models/Transaksi').default;
  const Subscriber = require('../models/Subscriber').default;
  const TtFinanceDaily = require('../models/TtFinanceDaily').default;
  const ThFinanceDaily = require('../models/ThFinanceDaily').default;

  // Cek apakah sudah tutup buku
  const thFinanceCount = await ThFinance.countDocuments({ tahun_fiskal: tahun });

  // Pilih collection
  const Collection = thFinanceCount > 0 ? ThFinance : Transaksi;
  const order = ["DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV"];

function sortDataBulanan(arr: any) {
  return arr.map((item : any) => {
    item.data_bulanan = item.data_bulanan.sort((a : any, b: any) => {
      const bulanA = a.bulan.substring(0, 3); // contoh: "DEC"
      const bulanB = b.bulan.substring(0, 3);

      return order.indexOf(bulanA) - order.indexOf(bulanB);
    });
    return item;
  });
}

function sortDataGross(arr: any) {
  return arr.sort((a: any, b: any) => {
    const bulanA = a.bulan.substring(0, 3);
    const bulanB = b.bulan.substring(0, 3);
    return order.indexOf(bulanA) - order.indexOf(bulanB);
  });
}
  // ===========================
  // DYNAMIC PIPELINE
  // ===========================

  const pipeline: any[] = [
    { $match: { tahun_fiskal: tahun } },
    { $unwind: '$data_bulanan' },
  ];

  // ➤ Tambahkan filter bulan hanya jika query bulan ada
  if (filterBulan) {
    pipeline.push({
      $match: {
        "data_bulanan.bulan": {
          $regex: filterBulan,
          $options: "i"
        }
      }
    });
  }

  pipeline.push(
    {
      $group: {
        _id: {
          kategori: '$kategori',
          sub_kategori: '$sub_kategori',
          bulan: '$data_bulanan.bulan'
        },
        nilai_bulan: { $sum: '$data_bulanan.nilai' }
      }
    },
    {
      $group: {
        _id: {
          kategori: '$_id.kategori',
          sub_kategori: '$_id.sub_kategori'
        },
        data_bulanan: {
          $push: {
            bulan: '$_id.bulan',
            nilai: '$nilai_bulan'
          }
        },
        total_sub_kategori: { $sum: '$nilai_bulan' }
      }
    },
    {
      $group: {
        _id: '$_id.kategori',
        kategori: { $first: '$_id.kategori' },
        subs: {
          $push: {
            sub_kategori: '$_id.sub_kategori',
            total: '$total_sub_kategori'
          }
        },
                total_kategori: { $sum: '$total_sub_kategori' }
      }
    },
    {
      $project: {
        kategori: 1,
        total_kategori: 1,
        subs: 1,
      }
    }
  );

  const pipelineAsetDanGaji: any[] = [
    { $match: { tahun_fiskal: tahun } },
    { $unwind: '$data_bulanan' },
  ];

  // ➤ Tambahkan filter bulan hanya jika query bulan ada
  if (filterBulan) {
    pipelineAsetDanGaji.push({
      $match: {
        "data_bulanan.bulan": {
          $regex: filterBulan,
          $options: "i"
        }
      }
    });
  }

  pipelineAsetDanGaji.push(
    {
      $match: {
        kategori: "BIAYA",
        sub_kategori: { $in: ["ASET", "ASET INVESTASI", "CICILAN GEDUNG", "CICILAN KENDARAAN", "GAJI"] }
      }
    },
    {
      $group: {
        _id: {
          kategori: '$kategori',
          sub_kategori: '$sub_kategori',
          bulan: '$data_bulanan.bulan'
        },
        nilai_bulan: { $sum: '$data_bulanan.nilai' }
      }
    },
    {
      $group: {
        _id: {
          kategori: '$_id.kategori',
          sub_kategori: '$_id.sub_kategori'
        },
        data_bulanan: {
          $push: {
            bulan: '$_id.bulan',
            nilai: '$nilai_bulan'
          }
        },
        total_sub_kategori: { $sum: '$nilai_bulan' }
      }
    },
    {
      $group: {
        _id: '$_id.kategori',
        kategori: { $first: '$_id.kategori' },
        subs: {
          $push: {
            sub_kategori: '$_id.sub_kategori',
            total: '$total_sub_kategori'
          }
        },
        total_kategori: { $sum: '$total_sub_kategori' }
      }
    },
    {
      $project: {
        kategori: "ASET DAN GAJI",
        total_kategori: 1,
        subs: 1,
      }
    }
  );

  const pipelineBiayaBiaya: any[] = [
    { $match: { tahun_fiskal: tahun } },
    { $unwind: '$data_bulanan' },
  ];

  // ➤ Tambahkan filter bulan hanya jika query bulan ada
  if (filterBulan) {
    pipelineBiayaBiaya.push({
      $match: {
        "data_bulanan.bulan": {
          $regex: filterBulan,
          $options: "i"
        }
      }
    });
  }

  pipelineBiayaBiaya.push(
    {
      $match: {
        kategori: "BIAYA",
        sub_kategori: { $in: [
          "PPH21",
          "PAJAK PPH 21",
          "VPS",
          "BIAYA VPS",
          "RND",
          "BIAYA RND",
          "BPJS",
          "BIAYA BPJS",
          "RETUR PENJUALAN"
        ] }
      }
    },
    {
      $group: {
        _id: {
          kategori: '$kategori',
          sub_kategori: '$sub_kategori',
          bulan: '$data_bulanan.bulan'
        },
        nilai_bulan: { $sum: '$data_bulanan.nilai' }
      }
    },
    {
      $group: {
        _id: {
          kategori: '$_id.kategori',
          sub_kategori: '$_id.sub_kategori'
        },
        data_bulanan: {
          $push: {
            bulan: '$_id.bulan',
            nilai: '$nilai_bulan'
          }
        },
        total_sub_kategori: { $sum: '$nilai_bulan' }
      }
    },
    {
      $group: {
        _id: '$_id.kategori',
        kategori: { $first: '$_id.kategori' },
        subs: {
          $push: {
            sub_kategori: '$_id.sub_kategori',
            total: '$total_sub_kategori'
          }
        },
        total_kategori: { $sum: '$total_sub_kategori' }
      }
    },
    {
      $project: {
        kategori: "BIAYA BIAYA",
        total_kategori: 1,
        subs: 1,
      }
    }
  );

  const pipelinePertahun: any[] = [
    { $match: { tahun_fiskal: tahun } },
    { $unwind: '$data_bulanan' },
    {
      $group: {
        _id: {
          kategori: '$kategori',
          bulan: '$data_bulanan.bulan'
        },
        total_bulan: { $sum: '$data_bulanan.nilai' }
      }
    },
    {
      $group: {
        _id: '$_id.kategori',
        kategori: { $first: '$_id.kategori' },
        data_bulanan: {
          $push: {
            bulan: '$_id.bulan',
            total: '$total_bulan'
          }
        },
        total_tahunan: { $sum: '$total_bulan' }
      }
    },
    {
      $project: {
        kategori: 1,
        data_bulanan: 1,
        total_tahunan: 1
      }
    },
    {
      $sort: { kategori: 1 }
    }
  ];

  let pipelineAsetDanGajiTahunan: any[];
  let asetGajiUseDaily = false;
  if (!filterBulan) {
    pipelineAsetDanGajiTahunan = [
      { $match: { tahun_fiskal: tahun } },
      {
        $match: {
          kategori: "BIAYA",
          sub_kategori: { $in: ["ASET", "ASET INVESTASI", "CICILAN GEDUNG", "CICILAN KENDARAAN", "GAJI"] }
        }
      },
      {
        $addFields: {
          group: {
            $cond: {
              if: { $eq: ["$sub_kategori", "GAJI"] },
              then: "GAJI",
              else: "ASET"
            }
          }
        }
      },
      { $unwind: '$data_bulanan' },
    ];
    if (filterBulan) {
      pipelineAsetDanGajiTahunan.push({
        $match: {
          "data_bulanan.bulan": { $regex: filterBulan, $options: "i" }
        }
      });
    }
    pipelineAsetDanGajiTahunan.push(
      {
        $group: {
          _id: { group: '$group', bulan: '$data_bulanan.bulan' },
          total_bulan: { $sum: '$data_bulanan.nilai' }
        }
      },
      {
        $group: {
          _id: '$_id.group',
          group: { $first: '$_id.group' },
          data_bulanan: { $push: { bulan: '$_id.bulan', total: '$total_bulan' } },
          total_tahunan: { $sum: '$total_bulan' }
        }
      },
      { $project: { group: 1, data_bulanan: 1, total_tahunan: 1 } },
      { $sort: { group: 1 } }
    );
  } else {
    asetGajiUseDaily = true;
    const thNum = parseInt(tahun, 10);
    const yyShort = (filterBulan === 'DEC' ? String((thNum - 1) % 100).padStart(2, '0') : String(thNum % 100).padStart(2, '0'));
    const targetBulanFiskal = `${filterBulan}-${yyShort}`;
    pipelineAsetDanGajiTahunan = [
      {
        $match: {
          tahun_fiskal: tahun,
          bulan_fiskal: targetBulanFiskal,
          kategori: "BIAYA",
          sub_kategori: { $in: ["ASET", "ASET INVESTASI", "CICILAN GEDUNG", "CICILAN KENDARAAN", "GAJI"] }
        }
      },
      {
        $addFields: {
          group: {
            $cond: {
              if: { $eq: ["$sub_kategori", "GAJI"] },
              then: "GAJI",
              else: "ASET"
            }
          }
        }
      },
      {
        $group: {
          _id: { group: '$group', tanggal: '$tanggal' },
          total_harian: { $sum: '$total_nilai' }
        }
      },
      { $sort: { '_id.tanggal': 1 } },
      {
        $group: {
          _id: '$_id.group',
          group: { $first: '$_id.group' },
          data_bulanan: { $push: { bulan: '$_id.tanggal', total: '$total_harian' } },
          total_tahunan: { $sum: '$total_harian' }
        }
      },
      { $project: { group: 1, data_bulanan: 1, total_tahunan: 1 } },
      { $sort: { group: 1 } }
    ];
  }

  const pipelineImplementasiMarketingLainnyaTahunan: any[] = [
    { $match: { tahun_fiskal: tahun } },
    {
      $match: {
        kategori: "BIAYA",
        sub_kategori: { $in: ["IMPLEMENTASI", "MARKETING", "LAIN LAIN"] }
      }
    },
    { $unwind: '$data_bulanan' },
  ];

  // ➤ Tambahkan filter bulan hanya jika query bulan ada
  if (filterBulan) {
    pipelineImplementasiMarketingLainnyaTahunan.push({
      $match: {
        "data_bulanan.bulan": {
          $regex: filterBulan,
          $options: "i"
        }
      }
    });
  }

  pipelineImplementasiMarketingLainnyaTahunan.push(
    {
      $group: {
        _id: {
          sub_kategori: '$sub_kategori',
          bulan: '$data_bulanan.bulan'
        },
        total_bulan: { $sum: '$data_bulanan.nilai' }
      }
    },
    {
      $group: {
        _id: '$_id.sub_kategori',
        sub_kategori: { $first: '$_id.sub_kategori' },
        data_bulanan: {
          $push: {
            bulan: '$_id.bulan',
            total: '$total_bulan'
          }
        },
        total_tahunan: { $sum: '$total_bulan' }
      }
    },
    {
      $project: {
        sub_kategori: 1,
        data_bulanan: 1,
        total_tahunan: 1
      }
    },
    {
      $sort: { sub_kategori: 1 }
    }
  );

  // ➤ Daily pipeline for Implementasi/Marketing/Lainnya when month is selected
  let pipelineImplementasiMarketingLainnyaDaily: any[] | undefined;
  if (filterBulan) {
    const thNum = parseInt(tahun, 10);
    const yyShort = (filterBulan === 'DEC' ? String((thNum - 1) % 100).padStart(2, '0') : String(thNum % 100).padStart(2, '0'));
    const targetBulanFiskal = `${filterBulan}-${yyShort}`;
    pipelineImplementasiMarketingLainnyaDaily = [
      {
        $match: {
          tahun_fiskal: tahun,
          bulan_fiskal: targetBulanFiskal,
          kategori: "BIAYA",
          sub_kategori: { $in: ["IMPLEMENTASI", "MARKETING", "LAIN LAIN"] }
        }
      },
      {
        $group: {
          _id: { sub_kategori: '$sub_kategori', tanggal: '$tanggal' },
          total_harian: { $sum: '$total_nilai' }
        }
      },
      { $sort: { '_id.tanggal': 1 } },
      {
        $group: {
          _id: '$_id.sub_kategori',
          sub_kategori: { $first: '$_id.sub_kategori' },
          data_bulanan: { $push: { bulan: '$_id.tanggal', total: '$total_harian' } },
          total_tahunan: { $sum: '$total_harian' }
        }
      },
      { $project: { sub_kategori: 1, data_bulanan: 1, total_tahunan: 1 } },
      { $sort: { sub_kategori: 1 } }
    ];
  }

  const pipelineBiayaBiayaTahunan: any[] = [
    { $match: { tahun_fiskal: tahun } },
    {
      $match: {
        kategori: "BIAYA",
        sub_kategori: { $in: [
          "PPH21",
          "PAJAK PPH 21",
          "VPS",
          "BIAYA VPS",
          "RND",
          "BIAYA RND",
          "BPJS",
          "BIAYA BPJS",
          "RETUR PENJUALAN"
        ] }
      }
    },
    { $unwind: '$data_bulanan' },
  ];

  // ➤ Tambahkan filter bulan hanya jika query bulan ada
  if (filterBulan) {
    pipelineBiayaBiayaTahunan.push({
      $match: {
        "data_bulanan.bulan": {
          $regex: filterBulan,
          $options: "i"
        }
      }
    });
  }

  pipelineBiayaBiayaTahunan.push(
    {
      $group: {
        _id: {
          sub_kategori: '$sub_kategori',
          bulan: '$data_bulanan.bulan'
        },
        total_bulan: { $sum: '$data_bulanan.nilai' }
      }
    },
    {
      $group: {
        _id: '$_id.sub_kategori',
        sub_kategori: { $first: '$_id.sub_kategori' },
        data_bulanan: {
          $push: {
            bulan: '$_id.bulan',
            total: '$total_bulan'
          }
        },
        total_tahunan: { $sum: '$total_bulan' }
      }
    },
    {
      $project: {
        sub_kategori: 1,
        data_bulanan: 1,
        total_tahunan: 1
      }
    },
    {
      $sort: { sub_kategori: 1 }
    }
  );

  // ➤ Daily pipeline for Biaya Biaya when month is selected
  let pipelineBiayaBiayaDaily: any[] | undefined;
  if (filterBulan) {
    const thNum = parseInt(tahun, 10);
    const yyShort = (filterBulan === 'DEC' ? String((thNum - 1) % 100).padStart(2, '0') : String(thNum % 100).padStart(2, '0'));
    const targetBulanFiskal = `${filterBulan}-${yyShort}`;
    pipelineBiayaBiayaDaily = [
      {
        $match: {
          tahun_fiskal: tahun,
          bulan_fiskal: targetBulanFiskal,
          kategori: "BIAYA",
          sub_kategori: { $in: [
            "PPH21",
            "PAJAK PPH 21",
            "VPS",
            "BIAYA VPS",
            "RND",
            "BIAYA RND",
            "BPJS",
            "BIAYA BPJS",
            "RETUR PENJUALAN"
          ] }
        }
      },
      {
        $group: {
          _id: { sub_kategori: '$sub_kategori', tanggal: '$tanggal' },
          total_harian: { $sum: '$total_nilai' }
        }
      },
      { $sort: { '_id.tanggal': 1 } },
      {
        $group: {
          _id: '$_id.sub_kategori',
          sub_kategori: { $first: '$_id.sub_kategori' },
          data_bulanan: { $push: { bulan: '$_id.tanggal', total: '$total_harian' } },
          total_tahunan: { $sum: '$total_harian' }
        }
      },
      { $project: { sub_kategori: 1, data_bulanan: 1, total_tahunan: 1 } },
      { $sort: { sub_kategori: 1 } }
    ];
  }

  // Gunakan basis daily aggregation agar konsisten dengan mode per-bulan (filter bulan).
  const pipelineGrossMarginTahunan: any[] = [
    {
      $match: {
        tahun_fiskal: tahun,
        kategori: { $in: ["PENDAPATAN", "BIAYA", "PEMBELIAN"] }
      }
    },
    {
      $group: {
        _id: { bulan: '$bulan_fiskal', kategori: '$kategori' },
        total_bulan: { $sum: '$total_nilai' }
      }
    },
    {
      $group: {
        _id: '$_id.bulan',
        bulan: { $first: '$_id.bulan' },
        totals: {
          $push: {
            kategori: '$_id.kategori',
            total: '$total_bulan'
          }
        }
      }
    },
    {
      $project: {
        bulan: 1,
        omzet: {
          $ifNull: [
            {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$totals',
                    cond: { $eq: ['$$this.kategori', 'PENDAPATAN'] }
                  }
                },
                0
              ]
            },
            { total: 0 }
          ]
        },
        biaya: {
          $ifNull: [
            {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$totals',
                    cond: { $eq: ['$$this.kategori', 'BIAYA'] }
                  }
                },
                0
              ]
            },
            { total: 0 }
          ]
        },
        pembelian: {
          $ifNull: [
            {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$totals',
                    cond: { $eq: ['$$this.kategori', 'PEMBELIAN'] }
                  }
                },
                0
              ]
            },
            { total: 0 }
          ]
        }
      }
    },
    {
      $project: {
        bulan: 1,
        gross_margin: {
          $subtract: [
            { $subtract: ['$omzet.total', '$biaya.total'] },
            '$pembelian.total'
          ]
        }
      }
    },
    { $sort: { bulan: 1 } }
  ];

  // ➤ Daily pipeline for Gross Margin when month is selected
  let pipelineGrossMarginDaily: any[] | undefined;
  if (filterBulan) {
    const thNum = parseInt(tahun, 10);
    const yyShort = (filterBulan === 'DEC' ? String((thNum - 1) % 100).padStart(2, '0') : String(thNum % 100).padStart(2, '0'));
    const targetBulanFiskal = `${filterBulan}-${yyShort}`;
    pipelineGrossMarginDaily = [
      {
        $match: {
          tahun_fiskal: tahun,
          bulan_fiskal: targetBulanFiskal,
          kategori: { $in: ["PENDAPATAN", "BIAYA", "PEMBELIAN"] }
        }
      },
      {
        $group: {
          _id: { tanggal: '$tanggal', kategori: '$kategori' },
          total: { $sum: '$total_nilai' }
        }
      },
      {
        $group: {
          _id: '$_id.tanggal',
          totals: { $push: { kategori: '$_id.kategori', total: '$total' } }
        }
      },
      {
        $project: {
          bulan: '$_id',
          omzet: {
            $ifNull: [
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$totals',
                      cond: { $eq: ['$$this.kategori', 'PENDAPATAN'] }
                    }
                  },
                  0
                ]
              },
              { total: 0 }
            ]
          },
          biaya: {
            $ifNull: [
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$totals',
                      cond: { $eq: ['$$this.kategori', 'BIAYA'] }
                    }
                  },
                  0
                ]
              },
              { total: 0 }
            ]
          },
          pembelian: {
            $ifNull: [
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$totals',
                      cond: { $eq: ['$$this.kategori', 'PEMBELIAN'] }
                    }
                  },
                  0
                ]
              },
              { total: 0 }
            ]
          }
        }
      },
      {
        $project: {
          bulan: 1,
          gross_margin: {
            $subtract: [
              { $subtract: ['$omzet.total', '$biaya.total'] },
              '$pembelian.total'
            ]
          }
        }
      },
      { $sort: { bulan: 1 } }
    ];
  }

  // ===========================
  // RUN PIPELINE
  // ===========================

  const result = await Collection.aggregate(pipeline);
  const resultAsetDanGaji = await Collection.aggregate(pipelineAsetDanGaji);
  const resultBiayaBiaya = await Collection.aggregate(pipelineBiayaBiaya);
  let resultPertahun;
  if (filterBulan) {
    const thNum = parseInt(tahun, 10);
    const yyShort = (filterBulan === 'DEC' ? String((thNum - 1) % 100).padStart(2, '0') : String(thNum % 100).padStart(2, '0'));
    const targetBulanFiskal = `${filterBulan}-${yyShort}`;
    const DailyCollection = thFinanceCount > 0 ? ThFinanceDaily : TtFinanceDaily;
    const dailyPipeline: any[] = [
      { $match: { tahun_fiskal: tahun, bulan_fiskal: targetBulanFiskal, kategori: { $in: ['PENDAPATAN', 'PEMBELIAN', 'BIAYA'] } } },
      { $group: { _id: { kategori: '$kategori', tanggal: '$tanggal' }, total_harian: { $sum: '$total_nilai' } } },
      { $sort: { '_id.tanggal': 1 } },
      { $group: { _id: '$_id.kategori', kategori: { $first: '$_id.kategori' }, data_bulanan: { $push: { bulan: '$_id.tanggal', total: '$total_harian' } }, total_tahunan: { $sum: '$total_harian' } } },
      { $project: { kategori: 1, data_bulanan: 1, total_tahunan: 1 } },
      { $sort: { kategori: 1 } }
    ];
    resultPertahun = await DailyCollection.aggregate(dailyPipeline);
  } else {
    resultPertahun = await Collection.aggregate(pipelinePertahun);
  }
  const resultAsetDanGajiTahunan = asetGajiUseDaily
    ? await (thFinanceCount > 0 ? ThFinanceDaily : TtFinanceDaily).aggregate(pipelineAsetDanGajiTahunan)
    : await Collection.aggregate(pipelineAsetDanGajiTahunan);
  const resultImplementasiMarketingLainnyaTahunan = filterBulan
    ? await (thFinanceCount > 0 ? ThFinanceDaily : TtFinanceDaily).aggregate(pipelineImplementasiMarketingLainnyaDaily!)
    : await Collection.aggregate(pipelineImplementasiMarketingLainnyaTahunan);
  const resultBiayaBiayaTahunan = filterBulan
    ? await (thFinanceCount > 0 ? ThFinanceDaily : TtFinanceDaily).aggregate(pipelineBiayaBiayaDaily!)
    : await Collection.aggregate(pipelineBiayaBiayaTahunan);
  const resultGrossMarginTahunan = filterBulan
    ? await (thFinanceCount > 0 ? ThFinanceDaily : TtFinanceDaily).aggregate(pipelineGrossMarginDaily!)
    : await (thFinanceCount > 0 ? ThFinanceDaily : TtFinanceDaily).aggregate(pipelineGrossMarginTahunan);
  
  res.json({
    success: true,
    tahun,
    bulan: filterBulan || null,
    data: result,
    asetDanGaji: resultAsetDanGaji,
    biayaBiaya: resultBiayaBiaya,
    pertahun: filterBulan ? resultPertahun : sortDataBulanan(resultPertahun),
    asetDanGajiTahunan: sortDataBulanan(resultAsetDanGajiTahunan),
    implementasiMarketingLainnyaTahunan: sortDataBulanan(resultImplementasiMarketingLainnyaTahunan),
    biayaBiayaTahunan: sortDataBulanan(resultBiayaBiayaTahunan),
    grossMarginTahunan: filterBulan ? resultGrossMarginTahunan : sortDataGross(resultGrossMarginTahunan),
  });
};

export const pendapatanHarian = async (req: Request, res: Response) => {
  try {
    const tahun = String(req.query.tahun || new Date().getFullYear());
    const bulan = String(req.query.bulan).toUpperCase();

    const TtFinanceDetail = require('../models/TtFinanceDetail').default;
    console.log(`${bulan}-${String(tahun).slice(-2)}`);
    
    // Pipeline untuk aggregate pendapatan harian per sub_kategori
    const pipeline = [
      {
        $match: {
          // tahun_fiskal: tahun,
          bulan: `${bulan}-${String(tahun).slice(-2)}`,
          kategori: 'PENDAPATAN',
          is_validated: true,
          status_deleted: { $ne: true },
          is_special_transaction: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            hari: { $toInt: { $substr: ['$tanggal', 8, 2] } }, // Extract day as number
            sub_kategori: '$sub_kategori'
          },
          total: { $sum: '$nilai' }
        }
      },
      {
        $project: {
          hari: {
            $concat: [
              { $cond: { if: { $lt: ['$_id.hari', 10] }, then: '0', else: '' } },
              { $toString: '$_id.hari' }
            ]
          },
          sub_kategori: '$_id.sub_kategori',
          total: 1,
          _id: 0
        }
      },
      {
        $sort: {
          hari: 1,
          sub_kategori: 1
        }
      }
    ];

    const result = await TtFinanceDetail.aggregate(pipeline);
    console.log(result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error in pendapatanHarian:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const subscriberGrowth = async (req: Request, res: Response) => {
  try {
    const tahun = String(req.params.tahun || req.query.tahun || new Date().getFullYear());
    const tahunNum = Number(tahun);
    if (!Number.isFinite(tahunNum)) {
      return res.status(400).json({ message: 'Tahun tidak valid' });
    }
    const Subscriber = require('../models/Subscriber').default;

    // Fiscal year: DEC (tahun-1) s/d NOV (tahun)
    const order = ['DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV'];
    const fiscalStart = new Date(Date.UTC(tahunNum - 1, 11, 1, 0, 0, 0, 0)); // 1 DEC tahun-1
    const fiscalEndExclusive = new Date(Date.UTC(tahunNum, 11, 1, 0, 0, 0, 0)); // 1 DEC tahun

    // Pipeline untuk menghitung subscriber baru per bulan
    const pipeline = [
      {
        $match: {
          status_aktv: true,
          tanggal: {
            $gte: fiscalStart,
            $lt: fiscalEndExclusive
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$tanggal"
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          bulan: {
            $switch: {
              branches: [
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "01"] }, then: "JAN" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "02"] }, then: "FEB" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "03"] }, then: "MAR" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "04"] }, then: "APR" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "05"] }, then: "MAY" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "06"] }, then: "JUN" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "07"] }, then: "JUL" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "08"] }, then: "AUG" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "09"] }, then: "SEP" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "10"] }, then: "OCT" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "11"] }, then: "NOV" },
                { case: { $eq: [{ $substr: ["$_id", 5, 2] }, "12"] }, then: "DEC" }
              ],
              default: "UNKNOWN"
            }
          },
          count: 1
        }
      },
      {
        $sort: {
          "_id": 1
        }
      }
    ];

    const result = await Subscriber.aggregate(pipeline);

    const allMonths: Array<{bulan: string, count: number, year: number}> = order.map((monthName, i) => ({
      bulan: monthName,
      count: 0,
      year: i === 0 ? tahunNum - 1 : tahunNum,
    }));

    // Isi data aktual
    result.forEach((item: any) => {
      const monthIndex = order.indexOf(item.bulan);
      if (monthIndex !== -1) {
        allMonths[monthIndex].count = item.count;
      }
    });

    // Hitung total subscriber
    const totalSubscriber = await Subscriber.countDocuments({
      status_aktv: true,
      tanggal: {
        $lt: fiscalEndExclusive // Sampai akhir November tahun
      }
    });

    res.json({
      success: true,
      tahun,
      totalSubscriber,
      data: allMonths
    });

  } catch (error) {
    console.error('❌ Error in subscriberGrowth:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const subscriberCumulative = async (req: Request, res: Response) => {
  try {
    const tahun = String(req.params.tahun || req.query.tahun || new Date().getFullYear());
    const tahunNum = Number(tahun);
    if (!Number.isFinite(tahunNum)) {
      return res.status(400).json({ message: 'Tahun tidak valid' });
    }
    const Subscriber = require('../models/Subscriber').default;

    const order = ['DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV'];
    const fiscalStart = new Date(Date.UTC(tahunNum - 1, 11, 1, 0, 0, 0, 0)); // 1 DEC tahun-1
    const fiscalEndExclusive = new Date(Date.UTC(tahunNum, 11, 1, 0, 0, 0, 0)); // 1 DEC tahun

    // Opening balance: aktif sebelum fiscal start.
    const openingBalance = await Subscriber.countDocuments({
      status_aktv: true,
      tanggal: { $lt: fiscalStart }
    });

    // Growth per fiscal month dalam range DEC..NOV.
    const growthPipeline = [
      {
        $match: {
          status_aktv: true,
          tanggal: {
            $gte: fiscalStart,
            $lt: fiscalEndExclusive
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%m',
              date: '$tanggal'
            }
          },
          count: { $sum: 1 }
        }
      }
    ];
    const growthRows = await Subscriber.aggregate(growthPipeline);
    const growthByMonth: Record<string, number> = {};
    growthRows.forEach((row: any) => {
      const mm = String(row._id || '').padStart(2, '0');
      const map: Record<string, string> = {
        '12': 'DEC', '01': 'JAN', '02': 'FEB', '03': 'MAR', '04': 'APR', '05': 'MAY',
        '06': 'JUN', '07': 'JUL', '08': 'AUG', '09': 'SEP', '10': 'OCT', '11': 'NOV',
      };
      const monthName = map[mm];
      if (monthName) growthByMonth[monthName] = Number(row.count || 0);
    });

    let runningTotal = openingBalance;
    const allMonths: Array<{bulan: string, total: number, year: number}> = order.map((bulan, idx) => {
      runningTotal += Number(growthByMonth[bulan] || 0);
      return {
        bulan,
        total: runningTotal,
        year: idx === 0 ? tahunNum - 1 : tahunNum,
      };
    });

    const totalSubscriber = runningTotal;

    // Optional guard logs for debugging fiscal cumulative consistency.
    if (allMonths.length > 0) {
      const decGrowth = Number(growthByMonth.DEC || 0);
      if (allMonths[0].total !== openingBalance + decGrowth) {
        console.warn('[subscriberCumulative] DEC total mismatch', { openingBalance, decGrowth, decTotal: allMonths[0].total });
      }
      for (let i = 1; i < allMonths.length; i++) {
        const expected = allMonths[i - 1].total + Number(growthByMonth[allMonths[i].bulan] || 0);
        if (allMonths[i].total !== expected) {
          console.warn('[subscriberCumulative] Running total mismatch', { idx: i, bulan: allMonths[i].bulan, expected, actual: allMonths[i].total });
        }
      }
    }

    res.json({
      success: true,
      tahun,
      totalSubscriber,
      opening_balance: openingBalance,
      fiscal_start_date: fiscalStart.toISOString().slice(0, 10),
      fiscal_end_date: new Date(fiscalEndExclusive.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      data: allMonths
    });

  } catch (error) {
    console.error('❌ Error in subscriberCumulative:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const subscriberByProgram = async (req: Request, res: Response) => {
  try {
    const tahun = String(req.query.tahun || new Date().getFullYear());
    let bulan = req.query.bulan || new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase();

    // Jika bulan adalah ANNUAL, gunakan NOV (bulan akhir tahun fiskal)
    if (bulan === 'ANNUAL') {
      bulan = 'NOV';
    }

    const Subscriber = require('../models/Subscriber').default;

    // Tentukan tanggal akhir berdasarkan bulan dan tahun yang dipilih
    const bulanMap: { [key: string]: number } = {
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
      'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
    };

    const bulanIndex = bulanMap[bulan as string] || 0;
    const endDate = new Date(parseInt(tahun), bulanIndex + 1, 0); // Akhir bulan yang dipilih

    // Pipeline untuk menghitung subscriber per program sampai bulan ini
    const pipeline = [
      {
        $match: {
          status_aktv: true,
          tanggal: {
            $lte: endDate
          }
        }
      },
      {
        $lookup: {
          from: 'tm_program',
          localField: 'program',
          foreignField: 'nama',
          as: 'program_info'
        }
      },
      {
        $unwind: {
          path: '$program_info',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          program: 1,
          biaya: 1,
          group_program: {
            $ifNull: ['$program_info.group_program', '$program']
          }
        }
      },
      {
        $group: {
          _id: '$group_program',
          programs: { $addToSet: '$program' },
          total_subscriber: { $sum: 1 },
          total_biaya: { $sum: '$biaya' }
        }
      },
      {
        $project: {
          program: '$_id',
          programs: 1,
          total_subscriber: 1,
          total_biaya: 1,
          avg_biaya_per_subscriber: {
            $cond: {
              if: { $eq: ['$total_subscriber', 0] },
              then: 0,
              else: { $divide: ['$total_biaya', '$total_subscriber'] }
            }
          }
        }
      },
      {
        $sort: {
          total_subscriber: -1
        }
      }
    ];

    const result = await Subscriber.aggregate(pipeline);

    // Hitung total keseluruhan
    const totalKeseluruhan = await Subscriber.countDocuments({
      status_aktv: true,
      tanggal: {
        $lte: endDate
      }
    });

    res.json({
      success: true,
      tahun,
      bulan: bulan === 'NOV' && req.query.bulan === 'ANNUAL' ? 'ANNUAL (NOV)' : bulan,
      totalKeseluruhan,
      data: result
    });

  } catch (error) {
    console.error('❌ Error in subscriberByProgram:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

function getISOWeekLabel(dateValue: Date): string {
  const date = new Date(Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function mongoISOWeekLabelExpr(dateExpr: any) {
  return {
    $concat: [
      { $toString: { $isoWeekYear: dateExpr } },
      '-W',
      {
        $let: {
          vars: { week: { $isoWeek: dateExpr } },
          in: {
            $cond: [
              { $lt: ['$$week', 10] },
              { $concat: ['0', { $toString: '$$week' }] },
              { $toString: '$$week' }
            ]
          }
        }
      }
    ]
  };
}

function parseDate(input?: string): Date {
  if (!input) return new Date();
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
}

function formatMonthYY(date: Date): string {
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${monthNames[date.getUTCMonth()]}-${String(date.getUTCFullYear()).slice(-2)}`;
}

function getFiscalMonthList(tahunNum: number): string[] {
  const months = ['DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV'];
  return months.map((m, idx) => `${m}-${String(idx === 0 ? (tahunNum - 1) : tahunNum).slice(-2)}`);
}

async function pickFinanceCollections(tahun: string) {
  const ThFinance = require('../models/ThFinance').default;
  const Transaksi = require('../models/Transaksi').default;
  const TtFinanceDaily = require('../models/TtFinanceDaily').default;
  const ThFinanceDaily = require('../models/ThFinanceDaily').default;
  const FiscalConfig = require('../models/FiscalConfig').default;
  const active = await FiscalConfig.findOne({ key: 'fiscal' });
  const activeYear = Number(active?.active_year || new Date().getFullYear());
  const targetYear = Number(tahun);
  const useArchive = Number.isFinite(targetYear) && targetYear < activeYear;
  return {
    summaryCollection: useArchive ? ThFinance : Transaksi,
    dailyCollection: useArchive ? ThFinanceDaily : TtFinanceDaily,
    source: useArchive ? 'th_finance' : 'tt_finance',
  };
}

export const dashboardV2CardData = async (req: Request, res: Response) => {
  try {
    const cardKey = String(req.query.card_key || '').trim();
    const periodMode = String(req.query.period_mode || 'monthly').toLowerCase();
    const fiscalYear = String(req.query.fiscal_year || new Date().getFullYear());
    const reference = String(req.query.reference || new Date().toISOString().slice(0, 10));
    const refDate = parseDate(reference);

    if (!cardKey) return res.status(400).json({ message: 'card_key is required' });
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(periodMode)) {
      return res.status(400).json({ message: 'period_mode must be daily|weekly|monthly|yearly' });
    }

    const { summaryCollection: SummaryModel, dailyCollection: DailyModel, source } = await pickFinanceCollections(fiscalYear);
    const Subscriber = require('../models/Subscriber').default;
    const TTVps = require('../models/TTVps').default;
    const Program = require('../models/Program').default;

    const tahunNum = Number(fiscalYear);
    const fiscalMonths = getFiscalMonthList(tahunNum);
    const targetMonthYY = formatMonthYY(refDate);

    const financialBuildPipeline = (match: any, mode: string) => {
      if (mode === 'daily') {
        return [
          { $match: { ...match, bulan_fiskal: targetMonthYY } },
          { $group: { _id: '$tanggal', total: { $sum: '$total_nilai' } } },
          { $sort: { _id: 1 } },
          { $project: { label: '$_id', value: '$total', _id: 0 } },
        ];
      }
      if (mode === 'weekly') {
        return [
          { $match: match },
          {
            $group: {
              _id: {
                $let: {
                  vars: { dateObj: { $dateFromString: { dateString: '$tanggal' } } },
                  in: mongoISOWeekLabelExpr('$$dateObj')
                }
              },
              total: { $sum: '$total_nilai' }
            }
          },
          { $sort: { _id: 1 } },
          { $project: { label: '$_id', value: '$total', _id: 0 } },
        ];
      }
      if (mode === 'yearly') {
        return [
          { $match: match },
          { $group: { _id: '$tahun_fiskal', total: { $sum: '$total_tahunan' } } },
          { $project: { label: '$_id', value: '$total', _id: 0 } },
        ];
      }
      return [
        { $match: match },
        { $unwind: '$data_bulanan' },
        { $group: { _id: '$data_bulanan.bulan', total: { $sum: '$data_bulanan.nilai' } } },
        { $sort: { _id: 1 } },
        { $project: { label: '$_id', value: '$total', _id: 0 } },
      ];
    };

    const send = (payload: any) =>
      res.json({
        success: true,
        card_key: cardKey,
        period_mode: periodMode,
        reference,
        fiscal_year: fiscalYear,
        ...payload,
      });

    if (
      [
        'pembelian_trend',
        'margin_trend',
        'aset_gaji_breakdown',
        'implementasi_marketing_lainnya_breakdown',
        'biaya_biaya_breakdown',
        'pendapatan_breakdown'
      ].includes(cardKey)
    ) {
      const baseSummaryMatch: any = { tahun_fiskal: fiscalYear };
      const baseDailyMatch: any = { tahun_fiskal: fiscalYear };

      if (cardKey === 'pembelian_trend') {
        const match = { ...baseSummaryMatch, kategori: 'PEMBELIAN' };
        const matchDaily = { ...baseDailyMatch, kategori: 'PEMBELIAN' };
        const pipeline = periodMode === 'daily' || periodMode === 'weekly'
          ? financialBuildPipeline(matchDaily, periodMode)
          : financialBuildPipeline(match, periodMode);
        const rows = await (periodMode === 'daily' || periodMode === 'weekly' ? DailyModel : SummaryModel).aggregate(pipeline);
        return send({
          source_info: { domain: 'financial', collection: source, fiscal_switch_applied: true },
          points: rows.map((r: any) => ({ bulan: r.label, nominal: Number(r.value || 0) })),
          totals: { total: rows.reduce((s: number, r: any) => s + Number(r.value || 0), 0) },
        });
      }

      if (cardKey === 'margin_trend') {
        // Always use daily aggregation as source of truth to keep annual/monthly consistent
        // with detailed (daily) margin calculation.
        const model = DailyModel;
        if (periodMode === 'daily') {
          const rows = await model.aggregate([
            { $match: { ...baseDailyMatch, bulan_fiskal: targetMonthYY, kategori: { $in: ['PENDAPATAN', 'BIAYA', 'PEMBELIAN'] } } },
            { $group: { _id: { label: '$tanggal', kategori: '$kategori' }, total: { $sum: '$total_nilai' } } },
          ]);
          const map: Record<string, any> = {};
          rows.forEach((r: any) => {
            const key = r._id.label;
            map[key] = map[key] || { pendapatan: 0, biaya: 0, pembelian: 0 };
            map[key][String(r._id.kategori).toLowerCase()] = Number(r.total || 0);
          });
          const points = Object.keys(map).sort().map((k) => ({
            bulan: k,
            nominal: map[k].pendapatan - map[k].biaya - map[k].pembelian,
          }));
          return send({
            source_info: { domain: 'financial', collection: source, fiscal_switch_applied: true },
            points,
            totals: { total: points.reduce((s, r) => s + r.nominal, 0) },
          });
        }
        if (periodMode === 'weekly') {
          const rows = await model.aggregate([
            { $match: { ...baseDailyMatch, kategori: { $in: ['PENDAPATAN', 'BIAYA', 'PEMBELIAN'] } } },
            {
              $group: {
                _id: {
                  label: {
                    $let: {
                      vars: { dateObj: { $dateFromString: { dateString: '$tanggal' } } },
                      in: mongoISOWeekLabelExpr('$$dateObj')
                    }
                  },
                  kategori: '$kategori'
                },
                total: { $sum: '$total_nilai' }
              }
            },
          ]);
          const map: Record<string, any> = {};
          rows.forEach((r: any) => {
            const key = r._id.label;
            map[key] = map[key] || { pendapatan: 0, biaya: 0, pembelian: 0 };
            map[key][String(r._id.kategori).toLowerCase()] = Number(r.total || 0);
          });
          const points = Object.keys(map).sort().map((k) => ({
            bulan: k,
            nominal: map[k].pendapatan - map[k].biaya - map[k].pembelian,
          }));
          return send({
            source_info: { domain: 'financial', collection: source, fiscal_switch_applied: true },
            points,
            totals: { total: points.reduce((s, r) => s + r.nominal, 0) },
          });
        }
        const rows = await model.aggregate([
          { $match: { ...baseDailyMatch, kategori: { $in: ['PENDAPATAN', 'BIAYA', 'PEMBELIAN'] } } },
          {
            $group: {
              _id: periodMode === 'monthly'
                ? { label: '$bulan_fiskal', kategori: '$kategori' }
                : { label: '$tahun_fiskal', kategori: '$kategori' },
              total: { $sum: '$total_nilai' }
            }
          },
        ]);
        const map: Record<string, any> = {};
        rows.forEach((r: any) => {
          const key = r._id.label;
          map[key] = map[key] || { pendapatan: 0, biaya: 0, pembelian: 0 };
          map[key][String(r._id.kategori).toLowerCase()] = Number(r.total || 0);
        });
        const points = Object.keys(map).sort().map((k) => ({
          bulan: k,
          nominal: map[k].pendapatan - map[k].biaya - map[k].pembelian,
        }));
        return send({
          source_info: { domain: 'financial', collection: source, fiscal_switch_applied: true },
          points,
          totals: { total: points.reduce((s, r) => s + r.nominal, 0) },
        });
      }

      const subGroups: Record<string, string[]> = {
        aset_gaji_breakdown: ['ASET', 'ASET INVESTASI', 'CICILAN GEDUNG', 'CICILAN KENDARAAN', 'GAJI'],
        implementasi_marketing_lainnya_breakdown: ['IMPLEMENTASI', 'MARKETING', 'LAIN LAIN'],
        biaya_biaya_breakdown: ['PPH21', 'PAJAK PPH 21', 'VPS', 'BIAYA VPS', 'RND', 'BIAYA RND', 'BPJS', 'BIAYA BPJS', 'RETUR PENJUALAN'],
        pendapatan_breakdown: [],
      };
      const subList = subGroups[cardKey] || [];
      const model = periodMode === 'daily' || periodMode === 'weekly' ? DailyModel : SummaryModel;
      const category = cardKey === 'pendapatan_breakdown' ? 'PENDAPATAN' : 'BIAYA';
      const useSubFilter = cardKey !== 'pendapatan_breakdown';

      const groupingField = periodMode === 'daily'
        ? '$tanggal'
        : periodMode === 'weekly'
          ? {
              $let: {
                vars: { dateObj: { $dateFromString: { dateString: '$tanggal' } } },
                in: mongoISOWeekLabelExpr('$$dateObj')
              }
            }
          : periodMode === 'monthly'
            ? '$data_bulanan.bulan'
            : '$tahun_fiskal';

      const rows = await model.aggregate([
        {
          $match: {
            ...(periodMode === 'daily' || periodMode === 'weekly' ? baseDailyMatch : baseSummaryMatch),
            ...(periodMode === 'daily' ? { bulan_fiskal: targetMonthYY } : {}),
            kategori: category,
            ...(useSubFilter ? { sub_kategori: { $in: subList } } : {}),
          }
        },
        ...(periodMode === 'monthly' ? [{ $unwind: '$data_bulanan' }] : []),
        {
          $group: {
            _id: { label: groupingField, sub_kategori: '$sub_kategori' },
            total: { $sum: periodMode === 'monthly' ? '$data_bulanan.nilai' : (periodMode === 'yearly' ? '$total_tahunan' : '$total_nilai') }
          }
        },
      ]);

      const labelMap: Record<string, Record<string, number>> = {};
      rows.forEach((r: any) => {
        const label = r._id.label;
        const sub = r._id.sub_kategori;
        labelMap[label] = labelMap[label] || {};
        labelMap[label][sub] = Number(r.total || 0);
      });
      const labels = Object.keys(labelMap).sort();
      const points = labels.map((label) => ({
        kategori: label,
        subs: Object.keys(labelMap[label]).map((sub) => ({ name: sub, total: labelMap[label][sub] }))
      }));
      return send({
        source_info: { domain: 'financial', collection: source, fiscal_switch_applied: true },
        points,
        totals: { total: rows.reduce((s: number, r: any) => s + Number(r.total || 0), 0) },
      });
    }

    if (cardKey === 'subscriber_analytics') {
      const start = new Date(Date.UTC(tahunNum - 1, 11, 1));
      const end = new Date(Date.UTC(tahunNum, 11, 1));
      const mode = periodMode;
      const match: any = { status_aktv: true, tanggal: { $gte: start, $lt: end } };
      const rows = await Subscriber.aggregate([
        { $match: match },
        {
          $project: {
            tanggal: 1,
            label:
              mode === 'daily'
                ? { $dateToString: { format: '%Y-%m-%d', date: '$tanggal' } }
                : mode === 'weekly'
                  ? mongoISOWeekLabelExpr('$tanggal')
                  : mode === 'yearly'
                    ? { $dateToString: { format: '%Y', date: '$tanggal' } }
                    : { $dateToString: { format: '%Y-%m', date: '$tanggal' } }
          }
        },
        { $group: { _id: '$label', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);
      const openingBalance = await Subscriber.countDocuments({ status_aktv: true, tanggal: { $lt: start } });
      let running = openingBalance;
      const points = rows.map((r: any) => {
        running += Number(r.count || 0);
        return { bulan: r._id, count: Number(r.count || 0), total: running, year: tahunNum };
      });
      return send({
        source_info: { domain: 'subscriber', collection: 'tm_subscriber', fiscal_switch_applied: false },
        points,
        totals: {
          total_growth: rows.reduce((s: number, r: any) => s + Number(r.count || 0), 0),
          total_subscriber: running,
        },
      });
    }

    if (cardKey === 'subscriber_by_program') {
      const mode = periodMode;
      const cutoff =
        mode === 'daily'
          ? new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate(), 23, 59, 59))
          : mode === 'weekly'
            ? new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate() + (7 - (refDate.getUTCDay() || 7)), 23, 59, 59))
            : mode === 'monthly'
              ? new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() + 1, 0, 23, 59, 59))
              : new Date(Date.UTC(refDate.getUTCFullYear(), 11, 31, 23, 59, 59));

      const rows = await Subscriber.aggregate([
        { $match: { status_aktv: true, tanggal: { $lte: cutoff } } },
        { $lookup: { from: 'tm_program', localField: 'program', foreignField: 'nama', as: 'program_info' } },
        { $unwind: { path: '$program_info', preserveNullAndEmptyArrays: true } },
        { $project: { program: 1, biaya: 1, group_program: { $ifNull: ['$program_info.group_program', '$program'] } } },
        {
          $group: {
            _id: '$group_program',
            programs: { $addToSet: '$program' },
            total_subscriber: { $sum: 1 },
            total_biaya: { $sum: '$biaya' }
          }
        },
        {
          $project: {
            program: '$_id',
            programs: 1,
            total_subscriber: 1,
            total_biaya: 1,
            avg_biaya_per_subscriber: {
              $cond: [{ $eq: ['$total_subscriber', 0] }, 0, { $divide: ['$total_biaya', '$total_subscriber'] }]
            }
          }
        },
        { $sort: { total_subscriber: -1 } }
      ]);
      return send({
        source_info: { domain: 'subscriber', collection: 'tm_subscriber', fiscal_switch_applied: false },
        points: rows,
        totals: { total_subscriber: rows.reduce((s: number, r: any) => s + Number(r.total_subscriber || 0), 0) },
      });
    }

    if (cardKey === 'vps_overview') {
      const docs = await TTVps.find({});
      const grouped: Record<string, { estimasi: number; realisasi: number }> = {};
      docs.forEach((d: any) => {
        const periode = String(d.periode || '');
        if (!periode) return;
        if (periodMode === 'yearly') {
          const year = periode.slice(0, 4);
          grouped[year] = grouped[year] || { estimasi: 0, realisasi: 0 };
          grouped[year].estimasi += Number(d.estimasi || 0);
          grouped[year].realisasi += Number(d.realisasi || 0);
          return;
        }
        if (periodMode === 'monthly') {
          grouped[periode] = grouped[periode] || { estimasi: 0, realisasi: 0 };
          grouped[periode].estimasi += Number(d.estimasi || 0);
          grouped[periode].realisasi += Number(d.realisasi || 0);
          return;
        }
        const dt = new Date(`${periode}-01T00:00:00.000Z`);
        const label = periodMode === 'weekly' ? getISOWeekLabel(dt) : `${periode}-01`;
        grouped[label] = grouped[label] || { estimasi: 0, realisasi: 0 };
        grouped[label].estimasi += Number(d.estimasi || 0);
        grouped[label].realisasi += Number(d.realisasi || 0);
      });
      const points = Object.keys(grouped).sort().map((k) => ({ name: k, estimasi: grouped[k].estimasi, realisasi: grouped[k].realisasi }));
      return send({
        source_info: { domain: 'vps', collection: 'tt_vps', fiscal_switch_applied: false },
        points,
        totals: {
          estimasi: points.reduce((s, p) => s + Number(p.estimasi || 0), 0),
          realisasi: points.reduce((s, p) => s + Number(p.realisasi || 0), 0),
        },
      });
    }

    return res.status(400).json({ message: 'Unsupported card_key' });
  } catch (error) {
    console.error('❌ Error in dashboardV2CardData:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
