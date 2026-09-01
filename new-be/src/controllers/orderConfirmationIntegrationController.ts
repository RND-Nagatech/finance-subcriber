import { NextFunction, Request, Response } from 'express';
import {
  getOrderConfirmationDetail,
  searchOrderConfirmationNoOk
} from '../services/orderConfirmationIntegrationService';

export const searchNoOk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await searchOrderConfirmationNoOk({
      search: String(req.query.search || req.query.q || '').trim(),
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 25),
      status: String(req.query.status || 'Validated')
    });

    res.json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    next(error);
  }
};

export const detailNoOk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const noOk = String(req.query.no_ok || req.query.noOk || '').trim();
    const data = await getOrderConfirmationDetail(noOk);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};
