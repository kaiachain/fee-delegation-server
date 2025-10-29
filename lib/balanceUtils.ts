import { ethers } from "ethers";

// Number of decimal places shown in UI (e.g. 5 decimal places = 0.00000)
const DISPLAY_DECIMALS = BigInt(5);
// Native KAIA uses 18 decimal places (like wei -> ether)
const WEI_DECIMALS = BigInt(18);
const WEI_UNIT = BigInt(10) ** WEI_DECIMALS;
const SCALE = BigInt(10) ** DISPLAY_DECIMALS;

/**
 * Convert a decimal string (e.g. "123.45") into wei using bigint arithmetic.
 * This avoids floating point rounding errors when dealing with huge values.
 */
const normalizeToWei = (value: string): bigint => {
  if (!value.includes('.')) {
    return BigInt(value);
  }

  const [wholePart, fractionPart = ''] = value.split('.');
  const paddedFraction = (fractionPart + '0'.repeat(Number(WEI_DECIMALS))).slice(0, Number(WEI_DECIMALS));
  return BigInt(wholePart) * WEI_UNIT + BigInt(paddedFraction);
};

/**
 * Convert a wei bigint into a human-readable KAIA string with DISPLAY_DECIMALS precision.
 * Uses pure bigint math so extremely large balances remain accurate.
 */
const formatWei = (weiValue: bigint): string => {
  const negative = weiValue < BigInt(0);
  let wei = negative ? -weiValue : weiValue;

  // Multiply by SCALE to preserve DISPLAY_DECIMALS, then round to the nearest value
  const scaled = (wei * SCALE + WEI_UNIT / BigInt(2)) / WEI_UNIT;
  const integerPart = scaled / SCALE;
  const fractionalPart = (scaled % SCALE).toString().padStart(Number(DISPLAY_DECIMALS), '0');
  const formatted = `${integerPart.toString()}.${fractionalPart}`;

  return negative ? `-${formatted}` : formatted;
};

/**
 * Format a balance expressed in wei (string/number/bigint) into a KAIA string with fixed decimals.
 * Falls back to ethers.formatUnits for unusual inputs, but still normalizes via bigint math.
 */
export const formatBalance = (balance: string | number | bigint): string => {
  if (balance === null || balance === undefined) {
    return '0.00000';
  }

  const stringValue = balance.toString();

  try {
    // Plain numeric strings are converted directly using bigint math
    if (/^[-+]?\d+(\.\d+)?$/.test(stringValue)) {
      const wei = normalizeToWei(stringValue);
      return formatWei(wei);
    }

    // Fallback: let ethers parse the value, then normalise the result for consistent rounding
    const formatted = ethers.formatUnits(stringValue, 'ether');
    return formatWei(normalizeToWei(formatted));
  } catch (error) {
    console.error('Error formatting balance:', error);
    return '0.00000';
  }
};

/**
 * Formats a balance value and adds the KAIA currency symbol
 * @param balance - Balance in wei (string or number)
 * @returns Formatted balance with KAIA symbol
 */
export const formatBalanceWithSymbol = (balance: string | number): string => {
  return `${formatBalance(balance)} KAIA`;
};

/**
 * Formats a balance for display in tables or cards
 * @param balance - Balance in wei (string or number)
 * @returns Formatted balance without currency symbol
 */
export const formatBalanceForDisplay = (balance: string | number): string => {
  return formatBalance(balance);
};

export const truncateAddress = (address: string, lead = 6, tail = 4) => {
  if (!address) return "-";
  if (address.length <= lead + tail) {
    return address;
  }
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
};

/**
 * Formats multiple balances in a DApp object
 * @param dapp - DApp object with balance and totalUsed fields
 * @returns DApp object with formatted balance fields
 */
export const formatDappBalances = (dapp: any) => {
  return {
    ...dapp,
    balance: formatBalance(dapp.balance),
    totalUsed: formatBalance(dapp.totalUsed)
  };
};

/**
 * Formats balances for multiple DApps
 * @param dapps - Array of DApp objects
 * @returns Array of DApp objects with formatted balance fields
 */
export const formatDappsBalances = (dapps: any[]) => {
  return dapps.map(formatDappBalances);
};
