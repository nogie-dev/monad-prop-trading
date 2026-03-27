import { useMemo } from 'react';
import { Contract } from 'ethers';
import { useWallet } from './useWallet';
import { ADDRESSES } from '../config/addresses';
import { PropChallengeABI } from '../abi/PropChallenge';
import { TradingAccountABI } from '../abi/TradingAccount';
import { TreasuryABI } from '../abi/Treasury';
import { AccountFactoryABI } from '../abi/AccountFactory';
import { ERC20ABI } from '../abi/ERC20';

export function useContracts() {
  const { signer } = useWallet();

  const propChallenge = useMemo(() => {
    if (!signer || !ADDRESSES.propChallenge) return null;
    return new Contract(ADDRESSES.propChallenge, PropChallengeABI, signer);
  }, [signer]);

  const accountFactory = useMemo(() => {
    if (!signer || !ADDRESSES.accountFactory) return null;
    return new Contract(ADDRESSES.accountFactory, AccountFactoryABI, signer);
  }, [signer]);

  const treasury = useMemo(() => {
    if (!signer || !ADDRESSES.treasury) return null;
    return new Contract(ADDRESSES.treasury, TreasuryABI, signer);
  }, [signer]);

  const usdc = useMemo(() => {
    if (!signer || !ADDRESSES.usdc) return null;
    return new Contract(ADDRESSES.usdc, ERC20ABI, signer);
  }, [signer]);

  return { propChallenge, accountFactory, treasury, usdc };
}

export function useTradingAccount(paAddress: string | null) {
  const { signer } = useWallet();
  return useMemo(() => {
    if (!signer || !paAddress) return null;
    return new Contract(paAddress, TradingAccountABI, signer);
  }, [signer, paAddress]);
}
