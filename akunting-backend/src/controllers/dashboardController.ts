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

  const pipelineGrossMarginTahunan: any[] = [
    { $match: { tahun_fiskal: tahun } },
    {
      $match: {
        kategori: { $in: ["PENDAPATAN", "BIAYA", "PEMBELIAN"] }
      }
    },
    { $unwind: '$data_bulanan' },
  ];

  // ➤ Tambahkan filter bulan hanya jika query bulan ada
  if (filterBulan) {
    pipelineGrossMarginTahunan.push({
      $match: {
        "data_bulanan.bulan": {
          $regex: filterBulan,
          $options: "i"
        }
      }
    });
  }

  pipelineGrossMarginTahunan.push(
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
    {
      $sort: {
        bulan: 1
      }
    }
  );

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
    : await Collection.aggregate(pipelineGrossMarginTahunan);
  
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
          status_deleted: { $ne: true }
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
    const tahun = String(req.query.tahun || new Date().getFullYear());
    const Subscriber = require('../models/Subscriber').default;

    // Urutan bulan dimulai dari Desember
    const order = ["DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV"];

    // Pipeline untuk menghitung subscriber baru per bulan
    const pipeline = [
      {
        $match: {
          status_aktv: true,
          tanggal: {
            $gte: new Date(`${parseInt(tahun) - 1}-12-01`), // Mulai dari Desember tahun sebelumnya
            $lt: new Date(`${parseInt(tahun)}-12-01`) // Sampai November tahun ini
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

    // Buat array lengkap untuk semua bulan dalam tahun fiskal (Desember tahun sebelumnya sampai November tahun ini)
    const allMonths: Array<{bulan: string, count: number, year: number}> = [];
    const startYear = parseInt(tahun) - 1; // Mulai dari Desember tahun sebelumnya

    for (let i = 0; i < 12; i++) {
      const monthName = order[i]; // Langsung ambil dari order array
      const year = (i === 0) ? startYear : parseInt(tahun); // Hanya bulan pertama (DEC) yang tahun sebelumnya
      allMonths.push({
        bulan: monthName,
        count: 0,
        year: year
      });
    }

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
        $lt: new Date(`${parseInt(tahun)}-12-01`) // Sampai akhir November tahun ini
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
    const tahun = String(req.query.tahun || new Date().getFullYear());
    const Subscriber = require('../models/Subscriber').default;

    // Urutan bulan dimulai dari Desember
    const order = ["DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV"];

    // Buat array lengkap untuk semua bulan dalam tahun fiskal (Desember tahun sebelumnya sampai November tahun ini)
    const allMonths: Array<{bulan: string, total: number, year: number}> = [];
    const startYear = parseInt(tahun) - 1; // Mulai dari Desember tahun sebelumnya

    for (let i = 0; i < 12; i++) {
      const monthName = order[i]; // Langsung ambil dari order array
      const year = (i === 0) ? startYear : parseInt(tahun); // Hanya bulan pertama (DEC) yang tahun sebelumnya
      allMonths.push({
        bulan: monthName,
        total: 0,
        year: year
      });
    }

    // Hitung total kumulatif untuk setiap bulan
    let cumulativeTotal = 0;
    for (let i = 0; i < 12; i++) {
      const monthName = order[i];
      const year = (i === 0) ? startYear : parseInt(tahun);

      // Tentukan tanggal akhir untuk bulan ini
      let endDate: Date;
      if (i === 0) { // DEC tahun sebelumnya
        endDate = new Date(`${startYear}-12-31`);
      } else if (i === 11) { // NOV tahun ini
        endDate = new Date(`${parseInt(tahun)}-11-30`);
      } else {
        // Untuk bulan lainnya, gunakan akhir bulan
        const monthNum = i; // 0 = JAN, 1 = FEB, ..., 10 = NOV
        const nextMonth = monthNum + 1;
        const endYear = nextMonth > 11 ? parseInt(tahun) + 1 : parseInt(tahun);
        const endMonth = nextMonth > 11 ? 0 : nextMonth;
        endDate = new Date(`${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`);
        endDate.setDate(endDate.getDate() - 1); // Akhir bulan sebelumnya
      }

      // Hitung total subscriber sampai akhir bulan ini
      const count = await Subscriber.countDocuments({
        status_aktv: true,
        tanggal: {
          $lte: endDate
        }
      });

      allMonths[i].total = count;
    }

    // Total subscriber akhir tahun fiskal
    const totalSubscriber = await Subscriber.countDocuments({
      status_aktv: true,
      tanggal: {
        $lte: new Date(`${parseInt(tahun)}-11-30`) // Sampai akhir November tahun ini
      }
    });

    res.json({
      success: true,
      tahun,
      totalSubscriber,
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
    const Program = require('../models/Program').default;

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
