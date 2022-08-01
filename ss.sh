let f=1
echo "failed time $f"

for i in {1..10};
do
  pnpm -- jest test/e2e/webpack-watch-wait-file-builder.test.ts --silent || echo "Failed after $i attempts" && break;
done
echo "failed time $f"


# pnpm -- jest test/e2e/webpack-watch-wait-file-builder.test.ts --silent ||
