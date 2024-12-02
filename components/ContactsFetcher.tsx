// components/ContactsFetcher.tsx

import React, { useEffect } from 'react';
import * as Contacts from 'expo-contacts';
import { db } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useUser } from '@/context/UserContext';

const ContactsFetcher: React.FC = () => {
  const { user } = useUser();

  useEffect(() => {
    const fetchContacts = async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
        });

        if (data.length > 0) {
          const phoneNumbers = data
            .flatMap((contact) => contact.phoneNumbers || [])
            .map((number) => number.number?.replace(/\s+/g, '') || '')
            .filter((number) => number.startsWith('+')); // E.164 format

          // Query Firestore for users with matching phone numbers
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('phoneNumber', 'in', phoneNumbers));
          const querySnapshot = await getDocs(q);

          const matchedUsers = querySnapshot.docs.map((doc) => doc.data());
          console.log('Matched Users:', matchedUsers);

          // You can now display or process the matched users as needed
        }
      } else {
        console.log('Permission to access contacts was denied');
      }
    };

    if (user) {
      fetchContacts();
    }
  }, [user]);

  return null; // This component doesn't render anything
};

export default ContactsFetcher;
