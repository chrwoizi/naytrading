import json

class Importer:
    def import_stream(self, stream, importer):
        character = stream.read(1)
        if character is None or len(character) == 0:
            return

        if character == '[':
            self.__import_list(stream, importer)
        else:
            raise Exception("Should start with [")

    def __import_list(self, reader, importer):
        while True:
            character = reader.read(1)
            if character is None or len(character) == 0:
                break

            if character == '{':
                self.__import_list_item(reader, importer)
            elif character == ']':
                return

    def __import_list_item(self, reader, importer):
        j = '{'
        is_in_quotes = False
        scopes = 1
        previous_character = '\0'
        while True:
            character = reader.read(1)
            if character is None or len(character) == 0:
                break

            j += character

            if previous_character != '\\' and character == '\"':
                is_in_quotes = not is_in_quotes
            elif (not is_in_quotes) and character == '{':
                scopes += 1
            elif (not is_in_quotes) and character == '}':
                scopes -= 1

                if scopes == 0:
                    item = DictObject(json.loads(j))
                    importer(item)
                    return

            previous_character = character

class DictObject(object):
    def __init__(self, d):
        self.__dict__ = d
        for k in self.__dict__.keys():
            v = self.__dict__[k]
            if isinstance(v, dict):
                self.__dict__[k] = DictObject(v)
            if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                self.__dict__[k] = [DictObject(x) for x in v]
