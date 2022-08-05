import { useLoaderData } from '@shuvi/runtime';

const One = () => {
  const data = useLoaderData();
  return (
    <div>
      <div data-test-id="hmr-one">This is the one page</div>
      <div data-test-id="time">{data?.time}</div>
    </div>
  );
};

export const loader = async () => {
  return {
    time: 1
  };
};

export default One;
