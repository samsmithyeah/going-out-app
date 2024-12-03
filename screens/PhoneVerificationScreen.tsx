import React, { useState, useRef } from 'react';
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
import CountryPicker, { CountryCode } from 'react-native-country-picker-modal';
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

const CELL_COUNT = 6;

const PhoneVerificationScreen: React.FC = () => {
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const [countryCode, setCountryCode] = useState<CountryCode>('GB');
  const [callingCode, setCallingCode] = useState<string>('44');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [isCountryPickerVisible, setCountryPickerVisible] = useState(false);
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

  const handleSendVerification = async () => {
    setFormError('');
    if (!phoneNumber.trim()) {
      setFormError('Please enter your phone number.');
      return;
    }

    // Remove leading zeros from phone number
    const sanitizedPhoneNumber = phoneNumber.trim().replace(/^0+/, '');

    const fullPhoneNumber = `+${callingCode}${sanitizedPhoneNumber}`;

    const phoneRegex = /^\+[1-9]\d{1,14}$/; // E.164 format
    if (!phoneRegex.test(fullPhoneNumber)) {
      setFormError('Please enter a valid phone number in E.164 format.');
      return;
    }

    setLoading(true);
    try {
      const phoneProvider = new PhoneAuthProvider(auth);
      const verId = await phoneProvider.verifyPhoneNumber(
        fullPhoneNumber,
        recaptchaVerifier.current as ApplicationVerifier,
      );
      setVerificationId(verId);
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
        await updateDoc(userDocRef, {
          phoneNumber: `+${callingCode}${phoneNumber.trim()}`,
        });
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Phone number verified',
        });

        const userData = userDoc.data() as User;

        setUser(userData);
      }
    } catch (error: unknown) {
      console.error('Error verifying code:', error);
      setFormError('Invalid verification code.');
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
            <CountryPicker
              countryCode={countryCode}
              withFilter
              withFlag
              withCallingCode
              onSelect={(country) => {
                setCountryCode(country.cca2);
                setCallingCode(country.callingCode[0]);
              }}
              visible={isCountryPickerVisible}
              onClose={() => setCountryPickerVisible(false)}
            />
            <TouchableOpacity
              onPress={() => setCountryPickerVisible(true)} // Open CountryPicker when Text is clicked
            >
              <Text style={styles.callingCode}>+{callingCode}</Text>
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

          {!verificationId ? (
            <CustomButton
              title="Send verification code"
              onPress={handleSendVerification}
              loading={loading}
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
  callingCode: {
    marginLeft: 10,
    fontSize: 16,
    color: '#444',
  },
  phoneInput: {
    flex: 1,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  codeFieldRoot: {
    marginBottom: 20,
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
  },
  focusCell: {
    borderColor: '#000',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 15,
  },
});

export default PhoneVerificationScreen;
