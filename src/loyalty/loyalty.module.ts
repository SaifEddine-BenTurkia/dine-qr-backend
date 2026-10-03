import { Module } from '@nestjs/common';
import {
  LoyaltyController,
  PublicLoyaltyController,
} from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import {
  GoogleWalletService,
  WALLET_FETCH,
  type WalletFetch,
} from './wallet.service';

// Google is given 8 seconds: a slow answer never blocks a guest's card.
const realFetch: WalletFetch = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(8000) });

@Module({
  controllers: [LoyaltyController, PublicLoyaltyController],
  providers: [
    { provide: WALLET_FETCH, useValue: realFetch },
    GoogleWalletService,
    LoyaltyService,
  ],
  exports: [LoyaltyService, GoogleWalletService],
})
export class LoyaltyModule {}
