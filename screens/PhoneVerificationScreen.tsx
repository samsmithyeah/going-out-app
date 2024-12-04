import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider, ApplicationVerifier } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import CustomButton from '@/components/CustomButton';
import Toast from 'react-native-toast-message';
import Colors from '@/styles/colors';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';
import { useRoute } from '@react-navigation/native';
import { firebaseConfig, auth, db } from '@/firebase';
import { NavParamList } from '@/navigation/AppNavigator';
import { User } from '@/types/User';
import { useUser } from '@/context/UserContext';
import { CountryPicker } from 'react-native-country-codes-picker';

const CELL_COUNT = 6;

// Helper function to convert country code to flag emoji
const getFlagEmoji = (countryCode: string): string => {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
};

const PhoneVerificationScreen: React.FC = () => {
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  // Update state to include country code and country ISO code
  const [selectedCountry, setSelectedCountry] = useState<{
    dial_code: string;
    country_code: string;
    name: string;
  }>({
    dial_code: '+44', // Default to UK
    country_code: 'GB',
    name: 'United Kingdom',
  });

  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [showCountryPicker, setShowCountryPicker] = useState<boolean>(false);
  const [fullPhoneNumber, setFullPhoneNumber] = useState<string>('');
  const { setUser } = useUser();

  const codeRef = useBlurOnFulfill({
    value: verificationCode,
    cellCount: CELL_COUNT,
  });
  const [codeFieldProps, getCellOnLayoutHandler] = useClearByFocusCell({
    value: verificationCode,
    setValue: setVerificationCode,
  });

  const route =
    useRoute<
      NativeStackScreenProps<NavParamList, 'PhoneVerification'>['route']
    >();
  const { uid } = route.params;

  useEffect(() => {
    const sanitized = phoneNumber.trim().replace(/^0+/, '');
    const computedFullPhoneNumber = `${selectedCountry.dial_code}${sanitized}`;
    setFullPhoneNumber(computedFullPhoneNumber);
  }, [selectedCountry, phoneNumber]);

  const handleSendVerification = async () => {
    setFormError('');
    if (!phoneNumber.trim()) {
      setFormError('Please enter your phone number.');
      return;
    }

    // Remove leading zeros from phone number
    const sanitizedPhoneNumber = phoneNumber.trim().replace(/^0+/, '');
    const fullPhoneNumberLocal = `${selectedCountry.dial_code}${sanitizedPhoneNumber}`;

    console.log('phoneNumber', phoneNumber);
    console.log('sanitizedPhoneNumber', sanitizedPhoneNumber);
    console.log('fullPhoneNumberLocal', fullPhoneNumberLocal);

    const phoneRegex = /^\+[1-9]\d{1,14}$/; // E.164 format
    if (!phoneRegex.test(fullPhoneNumberLocal)) {
      setFormError('Please enter a valid phone number in E.164 format.');
      return;
    }

    setLoading(true);
    try {
      const phoneProvider = new PhoneAuthProvider(auth);
      const verId = await phoneProvider.verifyPhoneNumber(
        fullPhoneNumberLocal,
        recaptchaVerifier.current as ApplicationVerifier,
      );
      setVerificationId(verId);
      setFullPhoneNumber(fullPhoneNumberLocal);

      Toast.show({
        type: 'success',
        text1: 'Verification code sent',
        text2: 'A verification code has been sent to your phone.',
      });
    } catch (error: unknown) {
      console.error('Error sending verification code:', error);
      setFormError('Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setFormError('');
    if (!verificationId) {
      setFormError('No verification ID found.');
      return;
    }
    if (!verificationCode.trim()) {
      setFormError('Please enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      // Fetch user data from Firestore
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        // Update Firestore with phone number
        console.log('Updating phone number:', fullPhoneNumber);
        await updateDoc(userDocRef, {
          phoneNumber: fullPhoneNumber,
          country: selectedCountry.country_code,
        });
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Phone number verified',
        });

        const userData = userDoc.data() as User;

        setUser(userData);
      } else {
        setFormError('User not found.');
      }
    } catch (error: unknown) {
      console.error('Error verifying code:', error);
      setFormError('Invalid verification code or network issue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={firebaseConfig}
          attemptInvisibleVerification={true}
        />

        <View style={styles.formContainer}>
          <Text style={styles.title}>Verify your phone number</Text>
          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <View style={styles.countryPickerContainer}>
            <TouchableOpacity
              onPress={() => setShowCountryPicker(true)}
              style={styles.countryPickerButton}
            >
              <Text style={styles.flagText}>
                {getFlagEmoji(selectedCountry.country_code)}
              </Text>
              <Text style={styles.countryCodeText}>
                {selectedCountry.dial_code}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
            {/* TODO: Convert this to CustomTextInput */}
            <TextInput
              placeholder="Phone number"
              placeholderTextColor="#666"
              value={phoneNumber}
              onChangeText={(text) => setPhoneNumber(text)}
              style={styles.phoneInput}
              keyboardType="phone-pad"
            />
          </View>
          <CountryPicker
            show={showCountryPicker}
            pickerButtonOnPress={(item: any) => {
              setSelectedCountry({
                dial_code: item.dial_code,
                country_code: item.code,
                name: item.name,
              });
              setShowCountryPicker(false);
            }}
            lang="en"
            style={{ modal: { height: '92%' } }}
          />
          {!verificationId ? (
            <CustomButton
              title="Send verification code"
              onPress={handleSendVerification}
              loading={loading}
              disabled={!phoneNumber.trim()}
            />
          ) : (
            <>
              <CodeField
                ref={codeRef}
                {...codeFieldProps}
                value={verificationCode}
                onChangeText={setVerificationCode}
                cellCount={CELL_COUNT}
                rootStyle={styles.codeFieldRoot}
                keyboardType="number-pad"
                renderCell={({ index, symbol, isFocused }) => (
                  <Text
                    key={index}
                    style={[styles.cell, isFocused && styles.focusCell]}
                    onLayout={getCellOnLayoutHandler(index)}
                  >
                    {symbol || (isFocused ? <Cursor /> : null)}
                  </Text>
                )}
              />
              <CustomButton
                title="Verify code"
                onPress={handleVerifyCode}
                loading={loading}
                disabled={verificationCode.length < CELL_COUNT}
              />
            </>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.flock,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#222',
  },
  countryPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  countryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginRight: 10,
  },
  flagText: {
    fontSize: 24,
    marginRight: 5,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#444',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    color: '#000',
  },
  codeFieldRoot: {
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  cell: {
    width: 40,
    height: 40,
    lineHeight: 38,
    fontSize: 24,
    borderWidth: 2,
    borderColor: '#ccc',
    textAlign: 'center',
    borderRadius: 5,
    marginHorizontal: 5,
  },
  focusCell: {
    borderColor: '#000',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 15,
  },
  dropdownArrow: {
    fontSize: 9,
    color: '#444',
    marginLeft: 2,
    marginTop: 9,
  },
});

export default PhoneVerificationScreen;
