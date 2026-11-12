import { receiptHtml, toCsv, type ReceiptData } from '@neofit/core';
import { cacheDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { UploadSummary } from '../cloud/types';

/** Receipts as PDF files and the owner's CSV export (SDD Sections 4.6 and 4.12). */
export class DocumentService {
  /** Opens the system's print dialog, where the member can choose Save as PDF. */
  async saveReceiptAsPdf(receipt: ReceiptData): Promise<void> {
    await Print.printAsync({ html: receiptHtml(receipt) });
  }

  /** Makes the PDF and opens the share sheet. */
  async shareReceipt(receipt: ReceiptData): Promise<void> {
    if (Platform.OS === 'web') return this.saveReceiptAsPdf(receipt);
    const { uri } = await Print.printToFileAsync({ html: receiptHtml(receipt) });
    await this.share(uri, 'application/pdf', `Receipt ${receipt.receiptNo}`);
  }

  /** The latest uploads as a CSV file, shared from the phone. */
  async exportUploads(uploads: readonly UploadSummary[]): Promise<void> {
    const csv = toCsv(
      ['Date', 'Staff', 'Entries', 'Total (PHP)', 'Synced'],
      uploads.map((u) => [u.date, u.staffName ?? '', u.totalEntries, u.totalAmount, u.isSynced]),
    );
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'neofit-uploads.csv';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const uri = `${cacheDirectory}neofit-uploads.csv`;
    await writeAsStringAsync(uri, csv, { encoding: EncodingType.UTF8 });
    await this.share(uri, 'text/csv', 'NeoFit uploads');
  }

  private async share(uri: string, mimeType: string, dialogTitle: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(uri, { mimeType, dialogTitle });
  }
}
