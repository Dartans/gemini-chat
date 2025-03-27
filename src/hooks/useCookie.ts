import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';

function useCookie(name: string, defaultValue: string = ''): [string, (value: string, options?: Cookies.CookieAttributes) => void, () => void] {
  const [value, setValue] = useState(() => Cookies.get(name) || defaultValue);

  useEffect(() => {
    setValue(Cookies.get(name) || defaultValue);
  }, [name, defaultValue]);

  const updateCookie = (newValue: string, options?: Cookies.CookieAttributes) => {
    Cookies.set(name, newValue, options);
    setValue(newValue);
  };

  const deleteCookie = () => {
    Cookies.remove(name);
    setValue(defaultValue);
  };

  return [value, updateCookie, deleteCookie];
}

export default useCookie;