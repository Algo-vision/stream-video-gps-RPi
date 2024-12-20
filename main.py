input_str = input("insert num: ")
while(int(input_str)<0):
    input_str = input("insert num: ")

sum_odd = 0
sum_even = 0
remain_num = int(input_str)
while remain_num >0:
    remainder = remain_num % 10
    if remainder %2 == 0:
        sum_even +=remainder
    else:
        sum_odd += remainder
    remain_num = int(remain_num/10)


print('sum odd: ', sum_odd)
print('sum even:',sum_even)
