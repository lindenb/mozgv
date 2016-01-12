.PHONY: all clean test


test: all
	firefox -app mozgv/application.ini #-jsconsole -purgecaches
all:
