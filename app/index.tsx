import { UserProvider } from '../context/UserContext';
import { CrewsProvider } from '../context/CrewsContext';
import { InvitationsProvider } from '../context/InvitationsContext';
import { registerRootComponent } from 'expo';
import Toast from 'react-native-toast-message';
import { LogBox } from 'react-native';
import App from './App';

LogBox.ignoreLogs([
  'Sending `onAnimatedValueUpdate` with no listeners registered.',
]);

const Root: React.FC = () => {
  return (
    <>
      <UserProvider>
        <CrewsProvider>
          <InvitationsProvider>
            <App />
          </InvitationsProvider>
        </CrewsProvider>
      </UserProvider>
      <Toast />
    </>
  );
};

export default Root;

registerRootComponent(App);
