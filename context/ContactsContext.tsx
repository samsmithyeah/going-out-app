// src/context/ContactsContext.tsx

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from 'react';
import { Contact } from '@/types/Contacts';
import {
  getAllContacts,
  requestContactsPermission,
  sanitizePhoneNumber,
} from '@/utils/contactsUtils';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase'; // Adjust the path based on your project structure
import { User } from '@/types/User';
import { useUser } from '@/context/UserContext';

interface ContactsContextValue {
  contacts: Contact[];
  matchedUsers: User[];
  loading: boolean;
  error: string | null;
  refreshContacts: () => Promise<void>;
}

const ContactsContext = createContext<ContactsContextValue | undefined>(
  undefined,
);

export const ContactsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [matchedUsers, setMatchedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  // Assume default country is 'GB' for UK users. Modify as needed for international support.
  const defaultCountry = 'GB';

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      const hasPermission = await requestContactsPermission();
      if (!hasPermission) {
        setError('Permission to access contacts was denied.');
        setLoading(false);
        return;
      }

      const deviceContacts = await getAllContacts();

      // Normalize and format contacts
      const formattedContacts: Contact[] = deviceContacts
        .map((contact) => {
          // Ensure contact.id is defined
          if (!contact.id) {
            console.warn(
              `Contact without ID skipped: ${JSON.stringify(contact)}`,
            );
            return null;
          }

          console.log('Contact:', contact);

          // Ensure phoneNumbers is defined and contains valid numbers
          const sanitizedPhoneNumbers =
            contact.phoneNumbers
              ?.map((pn) => pn.number)
              .filter(
                (number): number is string =>
                  typeof number === 'string' && number.trim() !== '',
              )
              .map((number) => sanitizePhoneNumber(number, defaultCountry))
              .filter((number) => number !== '') || [];

          console.log('Sanitized phone numbers:', sanitizedPhoneNumbers);
          if (sanitizedPhoneNumbers.length === 0) {
            console.log(
              'Skipping contact without valid phone numbers:',
              contact,
            );
            return null; // Skip contacts without valid phone numbers
          }

          return {
            id: contact.id,
            name: contact.name || 'Unnamed Contact',
            phoneNumbers: sanitizedPhoneNumbers,
          };
        })
        .filter(
          (contact): contact is Contact =>
            contact !== null && contact.phoneNumbers.length > 0,
        );

      setContacts(formattedContacts);

      // Extract unique phone numbers
      const allPhoneNumbers = formattedContacts.flatMap(
        (contact) => contact.phoneNumbers,
      );
      const uniquePhoneNumbers = Array.from(new Set(allPhoneNumbers));

      if (uniquePhoneNumbers.length === 0) {
        setMatchedUsers([]);
        setLoading(false);
        return;
      }

      console.log('Unique phone numbers:', uniquePhoneNumbers);

      // Fetch matched users from Firestore
      const matched = await fetchMatchedUsers(uniquePhoneNumbers);
      setMatchedUsers(matched);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError('Failed to load contacts.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchedUsers = async (phoneNumbers: string[]): Promise<User[]> => {
    const usersRef = collection(db, 'users');
    const batchSize = 10; // Firestore 'in' queries allow max 10 elements
    const batches = [];

    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      const batch = phoneNumbers.slice(i, i + batchSize);
      batches.push(batch);
    }

    const matched: User[] = [];

    const queryPromises = batches.map(async (batch) => {
      const q = query(usersRef, where('phoneNumber', 'in', batch));
      const querySnapshot = await getDocs(q);
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        matched.push({
          uid: doc.id,
          displayName: data.displayName,
          phoneNumber: data.phoneNumber,
          photoURL: data.photoURL || undefined,
          email: data.email,
        });
      }
    });

    await Promise.all(queryPromises);

    // Filter out the current user from the matched users
    const filteredMatched = matched.filter(
      (matchedUser) => matchedUser.uid !== user?.uid,
    );

    return filteredMatched;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    loadContacts();
  }, []);

  const refreshContacts = async () => {
    await loadContacts();
  };

  return (
    <ContactsContext.Provider
      value={{ contacts, matchedUsers, loading, error, refreshContacts }}
    >
      {children}
    </ContactsContext.Provider>
  );
};

// Custom hook for consuming the context
export const useContacts = () => {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContacts must be used within a ContactsProvider');
  }
  return context;
};
