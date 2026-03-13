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
