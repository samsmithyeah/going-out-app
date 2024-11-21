import { UserProvider } from '../context/UserContext';
import { CrewsProvider } from '../context/CrewsContext';
import { InvitationsProvider } from '../context/InvitationsContext';
import { CrewDateChatProvider } from '../context/CrewDateChatContext';
import { DirectMessagesProvider } from '../context/DirectMessagesContext';
import { BadgeCountProvider } from '../context/BadgeCountContext';
import { registerRootComponent } from 'expo';
import Toast, {
  BaseToast,
  ErrorToast,
  InfoToast,
  ToastProps,
} from 'react-native-toast-message';
import { LogBox } from 'react-native';
import App from './App';

LogBox.ignoreLogs([
  'Sending `onAnimatedValueUpdate` with no listeners registered.',
]);

const toastConfig = {
  success: (props: ToastProps) => (
    <BaseToast
      {...props}
      text1Style={{
        fontSize: 15,
        fontWeight: '400',
      }}
      text2Style={{
        fontSize: 13,
      }}
      style={{
        borderLeftColor: '#008000',
      }}
    />
  ),

  error: (props: ToastProps) => (
    <ErrorToast
      {...props}
      text1Style={{
        fontSize: 15,
        fontWeight: '400',
      }}
      text2Style={{
        fontSize: 13,
      }}
      style={{
        borderLeftColor: '#FF0000',
      }}
    />
  ),

  info: (props: ToastProps) => (
    <InfoToast
      {...props}
      text1Style={{
        fontSize: 15,
        fontWeight: '400',
      }}
      text2Style={{
        fontSize: 13,
      }}
      style={{
        borderLeftColor: '#FFA500',
      }}
    />
  ),
};

const Root: React.FC = () => {
  return (
    <>
      <UserProvider>
        <CrewsProvider>
          <InvitationsProvider>
            <CrewDateChatProvider>
              <DirectMessagesProvider>
                <BadgeCountProvider>
                  <App />
                </BadgeCountProvider>
              </DirectMessagesProvider>
            </CrewDateChatProvider>
          </InvitationsProvider>
        </CrewsProvider>
      </UserProvider>
      <Toast config={toastConfig} />
    </>
  );
};

export default Root;

registerRootComponent(App);
