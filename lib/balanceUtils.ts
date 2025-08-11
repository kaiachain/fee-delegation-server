import { ethers } from "ethers";

/**
 * Formats a balance value from wei to a human-readable format
 * @param balance - Balance in wei (string or number)
 * @returns Formatted balance with 5 decimal places
 */
export const formatBalance = (balance: string | number): string => {
  if (!balance) return "0.00000";
  
  try {
    // Convert to string if it's a number
    const balanceStr = balance.toString();
    
    // Convert from wei to ether and format to 5 decimal places
    const formatted = ethers.formatUnits(balanceStr, "ether");
    return parseFloat(formatted).toFixed(5);
  } catch (error) {
    console.error("Error formatting balance:", error);
    return "0.00000";
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
