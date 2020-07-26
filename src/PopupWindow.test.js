import React from 'react';
import { render } from '@testing-library/react';
import PopupWindow from './PopupWindow';

test('renders header', () => {
  const { getByText } = render(<PopupWindow />);
  const headerElement = getByText(/Netflix Skipper Settings/i);
  expect(headerElement).toBeInTheDocument();
});
