// src/utils/contactsUtils.ts

import * as Contacts from 'expo-contacts';
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export const requestContactsPermission = async (): Promise<boolean> => {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
};

export const getAllContacts = async (): Promise<Contacts.Contact[]> => {
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  if (data.length > 0) {
    return data;
  }
  return [];
};

/**
 * Sanitizes a phone number by converting it to E.164 format.
 * Assumes 'GB' as the default country for numbers starting with '0'.
 * For numbers already in international format, it validates and formats them accordingly.
 *
 * @param phone - The raw phone number string from contacts.
 * @param defaultCountry - The default country code (e.g., 'GB').
 * @returns The sanitized phone number in E.164 format, or an empty string if invalid.
 */
export const sanitizePhoneNumber = (
  phone: string,
  defaultCountry: CountryCode = 'GB',
): string => {
  // Remove all spaces, dashes, and parentheses
  const cleanedPhone = phone.replace(/[\s\-()]/g, '');

  // Attempt to parse the phone number
  const phoneNumber = parsePhoneNumberFromString(cleanedPhone, defaultCountry);

  if (phoneNumber?.isValid()) {
    return phoneNumber.number; // Returns in E.164 format
  }
  // Handle cases where the number might already be in E.164 but malformed
  if (cleanedPhone.startsWith('+')) {
    const fallbackNumber = parsePhoneNumberFromString(cleanedPhone);
    if (fallbackNumber?.isValid()) {
      return fallbackNumber.number;
    }
  }

  // If parsing fails, return an empty string or handle as per your requirement
  return '';
};
